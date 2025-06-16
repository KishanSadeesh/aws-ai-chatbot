// Automatic query genaration using deepseek ai works good(final version of code)
// from kishansadeesh13@gmail.com

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand} from "@aws-sdk/lib-dynamodb";

const client_db = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(client_db);
const cleanJsonResponse = (responseText) => {
  return responseText.replace(/```json|```js|```/g, '').trim();
};
export const handler = async (event) => {

  console.log("Received event:", event);

  try {
    const paramStr = event?.queryStringParameters?.param;
    if (!paramStr) throw new Error("Missing param");
    console.log("Query params:", event.queryStringParameters);
    const parsed = JSON.parse(paramStr); // { rawQuery: "..." }
    const rawQuery = parsed.rawQuery;
    if (!rawQuery) throw new Error("Missing rawQuery");
    
    const cleaned = cleanJsonResponse(rawQuery);
    const jsCode = cleaned.match(/new\s+(QueryCommand|ScanCommand)\s*\(([\s\S]*?)\);/);
if (!jsCode || !jsCode[1] || !jsCode[2]) {
  throw new Error("Invalid QueryCommand or ScanCommand format");
}

const commandType = jsCode[1]; // "QueryCommand" or "ScanCommand"
const commandBody = jsCode[2]; // e.g., { TableName: ..., FilterExpression: ..., ... }

// Safely parse the object body using `eval` (cautious but necessary here due to AI-generated string)
const commandInput = eval(`(${commandBody})`);

let queryCommand;
if (commandType === "QueryCommand") {
  queryCommand = new QueryCommand(commandInput);
} else if (commandType === "ScanCommand") {
  queryCommand = new ScanCommand(commandInput);
} else {
  throw new Error("Unsupported command type: " + commandType);
}

const result = await ddbDocClient.send(queryCommand);
console.log("Details fetched from db : ",result.Items);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
      body: JSON.stringify({
        response: result.Items || [],
      }),
    };
  } catch (err) {
    console.error("Query or parsing error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to process request.",
      }),
    };
  }
};
/* 
//old format previoss code worked with deepseek r1 only some types of questions
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client_db = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(client_db);

const dataset = [
  { id: 1, text: "We ship orders within 2‑3 business days." },
  { id: 2, text: "You can return items within 30 days of purchase." },
  { id: 3, text: "Our support email is nipurnait@gmail.com." },
];

const cleanJsonResponse = (responseText) => {
  return responseText.replace(/```json|```/g, '').trim();
};

const invokedeepseek = async (prompt) => {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer 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",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "model": "deepseek/deepseek-r1-0528:free",
      "messages": [
        {
          "role": "user",
          "content": prompt
        }
      ]
    })
  });

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content?.trim() || "";
  console.log("Extracted AI data: ", result);
  return result;
};

const detectIntentAndId = async (userMessage) => {
  const prompt = `
  You are a helpful assistant.

  Given the following user message:
  ${userMessage}
  
  Determine:
  - The user's intent, which should be one of these: "single_order", "list_orders", "aggregate", "unknown".
  - If there are one or more order IDs in the message, extract them as an array of strings. If none, leave the array empty.
  
  Respond in JSON format:
  {
    "intent": "<intent>",
    "id": ["<id1>", "<id2>", "..."]
  }
`.trim();

  const responseText = await invokedeepseek(prompt);
  console.log("DeepSeek Response for intent detection:", responseText);

  try {
    const cleaned = cleanJsonResponse(responseText);
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    const jsonOnly = cleaned.substring(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonOnly);
    console.log("parsed input : ", parsed);
    return parsed;
  } catch (error) {
    console.error("Invalid Intent JSON:", error, "Response:", responseText);
    return { intent: "unknown", id: [] };
  }
};

const fetchOrdersByIds = async (mid) => {
  const orders = [];

  for (const id of mid) {
    const data = await ddbDocClient.send(new GetCommand({
      TableName: 'Intern_Sample_Table',
      Key: { id: id }
    }));

    if (data.Item) {
      orders.push(data.Item);
    }
  }

  return orders;
};

const answerFromDataset = async (question) => {
  const context = dataset.map(d => d.text).join("\n");
  const prompt = `
You are a helpful assistant. 
Use the following reference text: "${context}"

Answer this user question:
"${question}"
If the question is different from the following reference text, answer it directly.Answer should be natural human language.
`;
  return await invokedeepseek(prompt);
};

export const handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);
  const userMsg = event.queryStringParameters.param;
  const {intent, id} = await detectIntentAndId(userMsg);

  console.log("Extracted Intent : ",intent,"id : ",id);
  let dbData;

  try {
    if (intent === "single_order" && id.length === 1) {
      // Fetch specific order by ID
      const data = await ddbDocClient.send(new GetCommand({
        TableName: 'Intern_Sample_Table',
        Key: { id: id[0] },
      }));

      if (!data.Item) {
        return {
          statusCode: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
          },
          body: JSON.stringify({ message: `Order with ID ${id[0]} not found.` }),
        };
      }
      dbData = data.Item;

    } else if ((intent === "single_order" && id.length > 1) || (intent === "aggregate" && id && id.length > 0)) {
      // Multiple orders
      const orders = await fetchOrdersByIds(id);
      if (orders.length === 0) {
        return {
          statusCode: 404,
          headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
          body: JSON.stringify({ message: `Orders not found for IDs: ${id.join(", ")}` }),
        };
      }
      dbData = orders;

    } else if (intent === "list_orders") {
      const data = await ddbDocClient.send(new ScanCommand({
        TableName: 'Intern_Sample_Table'
      }));
      dbData = data.Items.map(item => ({ id: item.id })) || [];
    } else if (intent === "aggregate") {
      const data = await ddbDocClient.send(new ScanCommand({
        TableName: 'Intern_Sample_Table'
      }));
      dbData = data.Items.map(item => ({ Amount: item.Amount })) || [];

    } else {
      const answer = await answerFromDataset(userMsg);
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({ response: answer }),
      };
    }

    const finalPrompt = `
You are a helpful assistant.

The user asked: "${userMsg}".

Here is the order data:
${JSON.stringify(dbData)}

Please provide a short, plain text answer to the user's question using this data. If not answer directly.
    `.trim();

    console.log("Final prompt to DeepSeek:", finalPrompt);

    const deepseekResponse = await invokedeepseek(finalPrompt);

    console.log("Final DeepSeek Response:", deepseekResponse);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      body: JSON.stringify({ response: deepseekResponse }),
    };

  } catch (err) {
    console.error("Error handling request:", err);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      body: JSON.stringify({ message: "Failed to process request." }),
    };
  }
};*/