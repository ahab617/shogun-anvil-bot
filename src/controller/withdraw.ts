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
    const newWithdraw = new Withdraw(props);
    const result = await newWithdraw.save();
    return result;
  } catch (error) {
    throw new Error("Failed to create withdrawInfo");
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
