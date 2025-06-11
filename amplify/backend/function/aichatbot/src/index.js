// intent based static answer works good final dynomodb and deepseek r1
// from kishansadeesh13@gmail.com
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
If the question is different from the following reference text, answer it directly.
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
      dbData = data.Items || [];
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
};


/*import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client_db = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(client_db);

const client = new BedrockRuntimeClient({
  region: "ap-south-1",
});

const invokeTitan = async (promptText) => {
  const command = new InvokeModelCommand({
    modelId: "amazon.titan-text-express-v1",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: promptText
    }),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  //return result.results[0].outputText.trim();
  return result;
};

// const prompt_getid = async (userMessage) => {
//   const prompt = `Extract the ID from the message and return ONLY the number, no text as JSON: {"id": "<id>"}. Message: "${userMessage}"`;
//   const result = await invokeClaude(prompt);
//   console.log("Claude's Response for id:", result);
//   return result;
// };

const prompt_status = async (Message) => {
  const result = await invokeTitan(Message);
  console.log("Titan's Response: \n", result);
  return result;
};

export const handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);
  
 const regex = /\d+/;
  const str = event.queryStringParameters.param;
  // const bedrock_id = await prompt_getid(event.queryStringParameters.param);
  // let parsed_id;
  const temp_id = str.match(regex);
 const id = temp_id ? Number(temp_id).toString() : null;
 console.log("Extracted ID:", id);
 // const id = parsed_id.id;
//   try {
//     parsed_id = JSON.parse(bedrock_id.id);
    // console.log("Extracted ID:", parsed_id);
  
//   } catch (e) {
//     console.error("Failed to parse ID response:", bedrock_id);
//     return {
//       statusCode: 400,
//       headers: {
//         "Access-Control-Allow-Origin": "*",
//         "Access-Control-Allow-Headers": "*"
//       },
//       body: JSON.stringify({ message: "Invalid response format from Bedrock." }),
//     };
//   }
// const id = parsed_id.id;
 if (!id) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },  
      body: JSON.stringify({ message: "Missing 'id' in event." }),
    };
  }

  const params = {
    TableName: 'Intern_Sample_Table',
    Key: { id: id },
  };

  try {
    const data = await ddbDocClient.send(new GetCommand(params));
    console.log("Given data items in db : " ,data.Item);
    if (!data.Item) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({ message: "Item not found." }),
      };
    }

    const prompt = `Based on this order info: Status ${data.Item.OrderStatus},id ${data.Item.id},Amount ${data.Item.Amount},OrderDate ${data.Item.OrderDate}, DeliveryDate ${data.Item.DeliveryDate} - what is the status and delivery of the order?`;
    console.log("This is the prompt: ",prompt);
    const bedrockResponse = await prompt_status(prompt);
    //const bedrockResponse = JSON.stringify({"inputTextTokenCount":60,"results":[{"tokenCount":30,"outputText":"\nBased on the provided content, the order status is ordered and the delivery date is 16-06-2025.","completionReason":"FINISH"}]});
    console.log("Bedrock Response : ", bedrockResponse);
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      body: JSON.stringify(bedrockResponse),
      //body: JSON.stringify({ results: [{ outputText: bedrockResponse }] }),
     // body: "Based on the provided order info, the order status is shipped and the delivery date is 03-06-2025.",
    };
  } catch (err) {
    console.error("Error fetching data:", err);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      body: JSON.stringify({ message: "Failed to fetch data." }),
    };
  }
};
*/

/*import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

const dbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(dbClient);

const bedrockClient = new BedrockRuntimeClient({ region: "ap-south-1" });

const invokeTitan = async (promptText) => {
  const command = new InvokeModelCommand({
    modelId: "amazon.titan-text-express-v1",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: promptText
    }),
  });
  const response = await bedrockClient.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.results?.[0]?.outputText?.trim();
};

export const handler = async (event) => {
  const userMessage = event.queryStringParameters?.param || "";

  // Ask Titan what action to perform
  const decisionPrompt = `Analyze this message and decide the user's intent.
If it is about a specific order, extract the order ID.
If it's about total orders or similar, respond as:
- {"action": "count_orders"} or {"action": "get_order", "id": "..."} (Respond strictly in JSON)
Message: "${userMessage}"`;

  const decisionText = await invokeTitan(decisionPrompt);
  console.log("Decision Response:", decisionText);

  let intent;
  try {
    intent = JSON.parse(decisionText);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Could not understand user's request." }),
    };
  }

  // 🧾 Total Orders Count
  if (intent.action === "count_orders") {
    try {
      const scan = await ddbDocClient.send(
        new ScanCommand({ TableName: "Intern_Sample_Table" })
      );
      const count = scan.Items.length;
      return {
        statusCode: 200,
        body: JSON.stringify({
          response: `There are a total of ${count} orders in the database.`,
        }),
      };
    } catch (err) {
      console.error("Error scanning:", err);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Failed to count orders." }),
      };
    }
  }

  // 🔍 Get Order by ID
  if (intent.action === "get_order" && intent.id) {
    const params = {
      TableName: "Intern_Sample_Table",
      Key: { id: intent.id },
    };

    try {
      const data = await ddbDocClient.send(new GetCommand(params));
      if (!data.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: `Order with ID ${intent.id} not found.` }),
        };
      }

      const finalPrompt = `You are an assistant. Using this data:
      - ID: ${data.Item.id}
      - Status: ${data.Item.OrderStatus}
      - Amount: ${data.Item.Amount}
      - Order Date: ${data.Item.OrderDate}
      - Delivery Date: ${data.Item.DeliveryDate}
      Answer this question: "${userMessage}"`;

      const answer = await invokeTitan(finalPrompt);
      return {
        statusCode: 200,
        body: JSON.stringify({ response: answer }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "DynamoDB read error." }),
      };
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ message: "Unsupported query." }),
  };
};*/