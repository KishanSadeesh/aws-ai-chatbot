import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand} from '@aws-sdk/lib-dynamodb';

const client_db = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(client_db);

const cleanJsonResponse = (responseText) => {
  // Remove markdown code fences and language hints
  return responseText.replace(/```json|```/g, '').trim();
};
// Function to call DeepSeek API
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
  console.log("Extracted AI data : ",data);
  return data.choices?.[0]?.message?.content?.trim() || "";
};

const detectIntentAndId = async (userMessage) => {
  const prompt = `
You are an assistant.

Given this user message:
"${userMessage}"

Determine the user's intent (one of these: "single_order", "list_orders", "aggregate", "unknown").
If there’s an order ID, extract it.

Respond with JSON:
{"intent": "<intent>", "id": "<id_or_empty_if_none>"}
  `.trim();

  const responseText = await invokedeepseek(prompt);
  console.log("DeepSeek Response for intent detection:", responseText);

  try {
    const cleaned = cleanJsonResponse(responseText);
    const parsed = JSON.parse(cleaned);
    return { intent: parsed.intent || "unknown", id: parsed.id || null };
  } catch (error) {
    console.error("Failed to parse DeepSeek intent response:", error, "Response:", responseText);
    return { intent: "unknown", id: null };
  }
};

/*
const ideprompt = async (userMessage) => {
  const prompt = `
  You are an assistant.

  Given this user message:
  "${userMessage}"
  
  Determine the user's intent (one of these: "single_order", "list_orders", "aggregate", "unknown").
  If there’s an order ID, extract it.
  
  Respond with JSON:
  {"intent": "<intent>", "id": "<id_or_empty_if_none>"}
`.trim();

  const responseText = await invokedeepseek(prompt);
  console.log("DeepSeek Response for ID extraction:", responseText);

  try {
    const parsed = JSON.parse(responseText);
    return {intent : parsed.intent || "nothing.", id : parsed.id || null};
  } catch (error) {
    console.error("Failed to parse DeepSeek ID response:", error);
    return null;
  }
};
*/

export const handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);
  const userMsg = event.queryStringParameters.param;
  const { intent, id } = await detectIntentAndId(userMsg);

  console.log("Extracted Intent:", intent, "ID:", id);
  /*const regex = /\d+/;
  
  const temp_id = str.match(regex);
  const id = temp_id ? Number(temp_id).toString() : null;
*/
let dbData;

  try {
    if (intent === "single_order" && id) {
      // Fetch specific order by ID
      const data = await ddbDocClient.send(new GetCommand({
        TableName: 'Intern_Sample_Table',
        Key: { id: id },
      }));

      if (!data.Item) {
        return {
          statusCode: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
          },
          body: JSON.stringify({ message: "Order not found." }),
        };
      }

      dbData = data.Item;

    } else if (intent === "list_orders") {
      // Fetch all orders
      const data = await ddbDocClient.send(new ScanCommand({
        TableName: 'Intern_Sample_Table'
      }));

      dbData = data.Items.map(item => ({ id: item.id })) || [];

    } else if (intent === "aggregate") {
      // Fetch all orders to calculate summary
      const data = await ddbDocClient.send(new ScanCommand({
        TableName: 'Intern_Sample_Table'
      }));

      dbData = data.Items.map(item => ({ Amount: item.Amount })) || [];

    } else {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({ message: "Could not determine intent. Please rephrase your question." }),
      };
    }
    const finalPrompt = `
    You are a helpful assistant.
    
    The user asked: "${userMsg}".
    
    Here is the order data:
    ${JSON.stringify(dbData)}
    
    Please provide a short, plain text answer to the user's question using this data.
        `;
    
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