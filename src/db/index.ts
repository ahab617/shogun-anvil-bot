import mongoose from "mongoose";
import { decryptPrivateKey } from "../service";

export const connectDatabase = async (mongoUrl: string) => {
  try {
    const options = {
      autoCreate: true,
      retryReads: true,
    } as mongoose.ConnectOptions;
    mongoose.set("strictQuery", true);
    const result = await mongoose.connect(mongoUrl, options);
    if (result) {
      console.log("MongoDB connected");
    }
  } catch (err) {
    console.log("MongoDB connect failed: ", err);
  }
};
