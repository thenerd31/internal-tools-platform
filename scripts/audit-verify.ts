import { verify } from "../src/platform/audit";
import { createDb } from "../src/platform/db";

const result = verify(createDb());
if (result.ok) {
  console.log(`OK ${result.count} rows`);
  process.exit(0);
} else {
  console.log(`BROKEN at seq ${result.brokenSeq}`);
  process.exit(1);
}
