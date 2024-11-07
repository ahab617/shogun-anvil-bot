const { Swap } = require("../db/model");
const findOne = async (props: any) => {
  const { filter } = props;
  try {
    const result = await Swap.findOne(filter);
    if (result) {
      return { status: 200, data: result };
    } else {
      return {
        status: 404,
        message: ` Swap Information not found.\n
<b>Command Line: </b> /activity`,
      };
    }
  } catch (error) {
    return {
      status: 500,
      message: "Internal server error. Please try again a later.",
    };
  }
};

const swapInfo = async () => {
  try {
    const result = await Swap.aggregate([
      {
        $lookup: {
          from: "wallets",
          localField: "userId",
          foreignField: "userId",
          as: "swapDetails",
        },
      },
    ]);
    return { status: 200, data: result };
  } catch (error) {
    return { status: 500, message: "Internal server error" };
  }
};

const create = async (tokenInfo: any) => {
  try {
    const newSwap = new Swap(tokenInfo);
    const newSwapSave = await newSwap.save();
    if (newSwapSave) {
      return {
        status: 200,
        message: "Swap created successfully",
        data: newSwapSave,
      };
    } else {
      return { status: 500, message: "Failed to save new swap" };
    }
  } catch (error) {
    return { status: 500, message: "Internal server error" };
  }
};

const updateOne = async (props: any) => {
  try {
    const result = await Swap.findOneAndUpdate(
      { userId: props.userId },
      { $set: props },
      { new: true }
    );
    if (result) {
      return {
        status: 200,
        message: "Swap updated successfully",
        data: result,
      };
    } else {
      return { status: 404, message: "Swap not found" };
    }
  } catch (error) {
    return { status: 500, message: "Internal server error" };
  }
};

const deleteOne = async (props: any) => {
  const { filter } = props;
  const result = await Swap.deleteOne(filter);
  return result;
};

export default {
  findOne,
  create,
  deleteOne,
  swapInfo,
  updateOne,
};
