const { FeeData } = require("../db/model");

const find = async (props: any) => {
  const { filter } = props;
  const result = await FeeData.find(filter);
  return result;
};

const create = async (props: any) => {
  try {
    // Create a new Withdraw instance with the modified properties
    const newFeeData = new FeeData(props);

    // Save the new document to the database
    const result = await newFeeData.save();
    return result;
  } catch (error) {
    console.log("Failed to create withdrawInfo:", error);
  }
};

const updateOne = async (props: any) => {
  try {
    const result = await FeeData.findOneAndUpdate(
      { _id: props._id },
      { $set: props }
    );
    return result;
  } catch (error) {
    throw new Error("Failed to update withdrawInfo");
  }
};

export default {
  create,
  find,
  updateOne,
};
