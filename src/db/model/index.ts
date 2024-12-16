import mongoose from "mongoose";
const Schema = mongoose.Schema;

const AdminSettingSchema = new Schema({
  userId: { type: Number, required: true },
  fee: { type: Number, required: true },
  miniAmount: { type: Number, required: true },
});

const AdminListSchema = new Schema({
  userId: { type: Number, required: true },
  userName: { type: String, required: true },
});

const UserListSchema = new Schema({
  userId: { type: Number, required: true },
  userName: { type: String, required: true },
  permission: { type: Boolean, default: false },
  fee: { type: Number, required: true },
});

const SwapSchema = new Schema({
  baseToken: { type: String, required: true },
  baseSymbol: { type: String, required: true },
  baseName: { type: String, required: true },
  baseBalance: { type: Number, required: true },
  quoteToken: { type: String, required: true },
  quoteName: { type: String, required: true },
  quoteSymbol: { type: String, required: true },
  quoteBalance: { type: Number, required: true },
  pairAddress: { type: String, required: true },
  baseDecimal: { type: Number, required: true },
  quoteDecimal: { type: Number, required: true },
  amount: { type: Number, required: true },
  userId: { type: Number, required: true },
  buy: { type: Number, required: true },
  sell: { type: Number, required: true },
  buyProgress: { type: Number, default: 0 },
  sellProgress: { type: Number, default: 0 },
  flag: { type: Boolean, default: true },
  isBalance: { type: Boolean, default: true },
  loopTime: { type: Number, required: true },
  priorityFee: { type: String, required: true },
  active: { type: Boolean, default: true },
  dir: { type: String, required: true },
});

const DepositSchema = new Schema({
  userId: { type: Number, required: true, unique: true },
  tokenAddress: {
    type: Array,
    required: true,
  },
});

const UserWalletSchema = new Schema({
  userId: { type: Number, required: true, unique: true },
  publicKey: { type: String, required: true },
  privateKey: { type: String, required: true },
  lastUpdated: { type: Date, default: Date.now },
});

const TokenSettingSchema = new Schema({
  userId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  pairInfo: { type: Array, required: true },
  decimal: { type: Number, required: true },
  publicKey: { type: String, required: true },
  lastUpdated: { type: Date, default: Date.now },
});

const WithdrawSchema = new Schema({
  userId: { type: Number, required: true },
  withdrawAddress: { type: String, required: true },
  token: { type: String, required: true },
  amount: { type: Number, required: true },
  privateKey: { type: String, required: true },
  lastUpdated: { type: Date, default: Date.now },
  uniqueKey: { type: String, unique: true }, // This will hold the unique key created in the controller
});

const FeeDataSchema = new Schema({
  userId: { type: Number, required: true },
  withdrawAddress: { type: String, required: true },
  token: { type: String, required: true },
  amount: { type: Number, required: true },
  privateKey: { type: String, required: true },
  status: { type: Number, default: 0 },
  txId: { type: String, default: "" },
});

export const Swap = mongoose.model("swaps", SwapSchema);
export const Tokens = mongoose.model("tokens", TokenSettingSchema);
export const Deposit = mongoose.model("deposits", DepositSchema);
export const Withdraw = mongoose.model("withdraw", WithdrawSchema);
export const Wallet = mongoose.model("wallets", UserWalletSchema);
export const AdminSetting = mongoose.model("adminSettings", AdminSettingSchema);
export const AdminList = mongoose.model("adminLists", AdminListSchema);
export const UserList = mongoose.model("userLists", UserListSchema);
export const FeeData = mongoose.model("feeData", FeeDataSchema);

export const getMaxFromCollection = async (
  collection: mongoose.Model<any>,
  field = "_id"
) => {
  const v = await collection.countDocuments({});
  return (v as number) || 0;
};
