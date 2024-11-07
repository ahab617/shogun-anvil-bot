import mongoose from "mongoose";
import setlog from "../utils/setlog";

export const connectDatabase = async (mongoUrl: string) => {
  try {
    const options = {
      autoCreate: true,
      retryReads: true,
    } as mongoose.ConnectOptions;
    mongoose.set("strictQuery", true);
    const result = await mongoose.connect(mongoUrl, options);
    if (result) {
      setlog("MongoDB connected");
    }
  } catch (err) {
    setlog("ConnectDatabase", err);
  }
};
