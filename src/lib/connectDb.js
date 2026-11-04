import mongoose from "mongoose";
import dns from "node:dns";

// Use public DNS resolvers because the configured resolver refused SRV lookups.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const connectDb = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Database connected: ${conn.connection.name}`);
  return conn;
};

export default connectDb;
