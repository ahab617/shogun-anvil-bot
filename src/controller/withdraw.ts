const { Withdraw } = require("../db/model");

const findOne = async (props: any) => {
  try {
    const { filter } = props;
    const result = await Withdraw.findOne(filter);
    return result;
  } catch (error) {
    throw new Error("Failed to find withdrawInfo");
  }
};

const find = async (props: any) => {
  const { filter } = props;
  const result = await Withdraw.find(filter);
  return result;
};

const create = async (props: any) => {
  try {
    const newProps = {
      ...props,
      uniqueKey: `${props.userId}-${Date.now()}`, // Add a unique key or modify conflicting fields
    };

    // Create a new Withdraw instance with the modified properties
    const newWithdraw = new Withdraw(newProps);

    // Save the new document to the database
    const result = await newWithdraw.save();
    return result;
  } catch (error) {
    console.log("Failed to create withdrawInfo:", error);
  }
};

const updateOne = async (props: any) => {
  try {
    const result = await Withdraw.findOneAndUpdate(
      { userId: props.userId },
      { $set: { flag: true } }
    );
    return result;
  } catch (error) {
    throw new Error("Failed to update withdrawInfo");
  }
};

export default {
  findOne,
  create,
  find,
  updateOne,
};
