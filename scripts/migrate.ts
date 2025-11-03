import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config();

const runMigrate = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL 未定义");
  }

  const connection = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("⏳ 运行迁移...");

  const start = Date.now();
  await migrate(db, { migrationsFolder: "./src/database/migrations" });
  const end = Date.now();

  console.log("✅ 迁移已完成 🎉 用时：", end - start, "ms");
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("❌ 迁移失败");
  console.error(err);
  process.exit(1);
});
