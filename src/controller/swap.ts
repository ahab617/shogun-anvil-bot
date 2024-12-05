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
    throw new Error("Failed to find swapInfo");
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
    throw new Error("Failed to find swapInfo");
  }
};

const create = async (tokenInfo: any) => {
  try {
    console.log(tokenInfo);
    const newSwap = new Swap(tokenInfo);
    const newSwapSave = await newSwap.save();
    if (newSwapSave) {
      return {
        status: 200,
        message: "Swap created successfully",
        data: newSwapSave,
      };
    }
  } catch (error) {
    throw new Error("Failed to create swapInfo");
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
    throw new Error("Failed to update swapInfo");
  }
};

const deleteOne = async (props: any) => {
  try {
    const { filter } = props;
    const result = await Swap.deleteOne(filter);
    return result;
  } catch (error) {
    throw new Error("Failed to delete swapInfo");
  }
};

export default {
  findOne,
  create,
  deleteOne,
  swapInfo,
  updateOne,
};
