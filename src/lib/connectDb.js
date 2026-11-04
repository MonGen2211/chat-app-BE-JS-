import mongoose from "mongoose";
import dns from "node:dns";

const connectDb = async () => {
  // Railway and other hosts should use their platform DNS. Use public resolvers
  // only for local development, or when explicitly configured by the operator.
  const configuredDns = process.env.MONGODB_DNS_SERVERS
    ?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);
  const runningOnRailway = Boolean(
    process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_ID,
  );
  if (configuredDns?.length) {
    dns.setServers(configuredDns);
  } else if (process.env.NODE_ENV === "development" && !runningOnRailway) {
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
  }

  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log(`Database connected: ${conn.connection.name}`);
  return conn;
};

export default connectDb;
