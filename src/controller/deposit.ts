const { Deposit } = require("../db/model");

const findOne = async (props: any) => {
  const { filter } = props;
  try {
    const result = await Deposit.findOne(filter);
    return result;
  } catch (error) {
    throw new Error("Failed to find deposit");
  }
};

const create = async (props: any) => {
  try {
    const userDeposit = await Deposit.findOne({
      userId: props.userId,
      txId: props.txId,
    });
    if (userDeposit) {
      return {
        status: 201,
        msg: `It is a hash that has already been entered. Please enter valid hash.`,
      };
    } else {
      const newDeposit = new Deposit(props);
      await newDeposit.save();
      return { status: 200, msg: `` };
    }
  } catch (error) {
    console.log("Server internal error");
    return { status: 500, msg: `` };
  }
};

export default {
  findOne,
  create,
};
