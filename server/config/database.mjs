import { MongoClient } from "mongodb";
export async function connectDatabase(uri) {
  if (!uri) throw Error("MONGODB_URI is required");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  return client;
}
