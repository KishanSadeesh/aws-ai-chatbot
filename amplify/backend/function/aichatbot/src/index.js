import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
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