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

const create = async (tokenInfo: any) => {
  try {
    const userDeposit = await Deposit.findOne({ userId: tokenInfo.userId });

    if (userDeposit) {
      const tokenExists = userDeposit.tokenAddress.includes(
        tokenInfo.tokenInfo
      );

      if (tokenExists) {
        return {
          status: 202,
          message: "Deposit Is completed.",
        };
      } else {
        userDeposit.tokenAddress.push(tokenInfo.tokenInfo);
        const updateResult = await Deposit.findOneAndUpdate(
          { userId: tokenInfo.userId },
          { $set: { tokenAddress: userDeposit.tokenAddress } },
          { new: true }
        );
        if (updateResult) {
          return {
            status: 200,
            message: "Deposit is completed successfully.",
          };
        } else {
          return {
            status: 201,
            message: "Failed to update token address",
          };
        }
      }
    } else {
      const newDeposit = new Deposit({
        userId: tokenInfo.userId,
        tokenAddress: [tokenInfo.tokenInfo],
      });

      const saveResult = await newDeposit.save();
      if (saveResult) {
        return {
          status: 200,
          message: "New deposit created successfully",
        };
      } else {
        return { status: 201, message: "Failed to create new deposit" };
      }
    }
  } catch (error) {
    throw new Error("Failed to create deposit");
  }
};

export default {
  findOne,
  create,
};
