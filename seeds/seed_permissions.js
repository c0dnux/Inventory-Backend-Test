const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Permission = require("./../models/permission_model");
const Role = require("./../models/role_model");

dotenv.config({ path: "./config.env" });

const permissions = [
  {
    name: "products:create",
    resource: "products",
    action: "create",
    description:
      "Allows users to add new products to the inventory catalog.",
  },
  {
    name: "products:read",
    resource: "products",
    action: "read",
    description: "Allows users to view product information, pricing, and availability.",
  },
  {
    name: "products:update",
    resource: "products",
    action: "update",
    description:
      "Allows users to modify existing product details such as name, price, and description.",
  },
  {
    name: "products:delete",
    resource: "products",
    action: "delete",
    description:
      "Allows users to permanently remove products from the inventory system.",
  },
  {
    name: "purchases:create",
    resource: "purchases",
    action: "create",
    description:
      "Allows users to record and process new purchase transactions.",
  },
  {
    name: "purchases:cancel",
    resource: "purchases",
    action: "cancel",
    description:
      "Allows users to cancel or remove purchase records when necessary.",
  },
  {
    name: "stock:adjust",
    resource: "stock",
    action: "adjust",
    description:
      "Allows users to monitor stock levels, adjust quantities, and manage inventory movements.",
  },
  {
    name: "suppliers:manage",
    resource: "suppliers",
    action: "manage",
    description:
      "Allows users to create, update, and manage supplier profiles.",
  },
  {
    name: "users:manage",
    resource: "users",
    action: "manage",
    description:
      "Allows users to create, update, deactivate, and manage user accounts and roles.",
  },
  {
    name: "permissions:manage",
    resource: "permissions",
    action: "manage",
    description:
      "Allows users to create, update, and manage permission records.",
  },
  {
    name: "roles:manage",
    resource: "roles",
    action: "manage",
    description:
      "Allows users to create, update, and manage roles and their permissions.",
  },
  {
    name: "audits:read",
    resource: "audits",
    action: "read",
    description:
      "Allows users to view and generate sales, inventory, and performance reports.",
  },
];

const rolePermissionMap = {
  Admin: permissions.map((p) => p.name),
  Manager: [
    "products:create",
    "products:read",
    "products:update",
    "purchases:create",
    "stock:adjust",
    "suppliers:manage",
    "audits:read",
  ],
  Staff: ["products:read"],
};

const roleDescriptions = {
  Admin: "Full system access across all resources.",
  Manager:
    "Can manage products, purchases, stock, suppliers, and view audits.",
  Staff: "Read-only access to product information.",
};

const seed = async () => {
  const DB_LOCAL = process.env.DB_LOCAL;
  const DB_ONLINE = process.env.DB_ONLINE_COMPASS.replace(
    "<db_password>",
    process.env.DB_PASSWORD,
  );
  const DB = process.env.NODE_ENV === "production" ? DB_ONLINE : DB_LOCAL;

  await mongoose.connect(DB);
  console.log("DB connection successful!");

  const savedPerms = {};
  for (const perm of permissions) {
    const doc = await Permission.findOneAndUpdate(
      { name: perm.name },
      perm,
      { new: true, upsert: true, runValidators: true },
    );
    savedPerms[perm.name] = doc._id;
    console.log(`Upserted permission: ${perm.name}`);
  }

  for (const [roleName, permNames] of Object.entries(rolePermissionMap)) {
    const permIds = permNames.map((name) => savedPerms[name]);
    await Role.findOneAndUpdate(
      { name: roleName },
      {
        $set: { permissions: permIds },
        $setOnInsert: { description: roleDescriptions[roleName] },
      },
      { new: true, upsert: true },
    );
    console.log(
      `Upserted role: ${roleName} (${permIds.length} permissions)`,
    );
  }

  await mongoose.disconnect();
  console.log("Seeding complete.");
};

seed().catch(async (err) => {
  console.error("Seeding failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
