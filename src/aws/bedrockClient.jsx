import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Setup the client
const client = new BedrockRuntimeClient({
  region: "us-east-1", // Change based on your Bedrock availability
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY
  }
});

export const invokeClaude = async (promptText) => {
  const command = new InvokeModelCommand({
    modelId: "anthropic.claude-instant-v1", // Or another supported model
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      prompt: `\n\nHuman: ${promptText}\n\nAssistant:`,
      max_tokens_to_sample: 200,
    }),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.completion;
};
