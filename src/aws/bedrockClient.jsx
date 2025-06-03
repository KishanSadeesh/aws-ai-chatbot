import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Setup the client
const client = new BedrockRuntimeClient({
  region: "ap-south-1", // Change based on your Bedrock availability
});

export const invokeClaude = async (promptText) => {
  const command = new InvokeModelCommand({
    modelId: "amazon.titan-text-express-v1", // Or another supported model
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      prompt: `\n\nHuman: ${promptText}\n\nAssistant:`,
      max_tokens_to_sample: 100,
    }),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.completion;
};
