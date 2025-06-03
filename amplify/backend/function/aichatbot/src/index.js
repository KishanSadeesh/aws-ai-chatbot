import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client_db = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(client_db);

const client = new BedrockRuntimeClient({
  region: "ap-south-1",
});

const invokeClaude = async (promptText) => {
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
  return result.results[0].outputText.trim();
};

// const prompt_getid = async (userMessage) => {
//   const prompt = `Extract the ID from the message and return ONLY the number, no text as JSON: {"id": "<id>"}. Message: "${userMessage}"`;
//   const result = await invokeClaude(prompt);
//   console.log("Claude's Response for id:", result);
//   return result;
// };

const prompt_status = async (Message) => {
  const result = await invokeClaude(Message);
  console.log("Titan's Response for id:", result);
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
    console.log("THis is the prompt: ",prompt);
    const bedrockResponse = await prompt_status(prompt);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      //body: JSON.stringify(bedrockResponse),
      body: JSON.stringify({ results: [{ outputText: bedrockResponse }] }),
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
