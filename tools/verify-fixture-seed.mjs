import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { requireTestDatabaseUrl } from '../apps/api/test/test-database.cjs';
const connectionString=requireTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const db=new Client({connectionString});await db.connect();
async function snapshot(){
  const output={};
  for(const table of ['FixtureVersion','Place','Hotel','RoomRate']){
    const {rows}=await db.query(`SELECT row_to_json(t) AS row FROM "${table}" t ORDER BY row_to_json(t)::text`);
    output[table]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
  }
  return output;
}
try{
  const before=await snapshot();
  for (const [version, places, hotels, rates] of [['showcase-v1',90,308,924],['showcase-v2',112,462,1386]]) {
    for (const [table,count] of [['Place',places],['Hotel',hotels],['RoomRate',rates]]) {
      const {rows}=await db.query(`SELECT count(*)::integer AS count FROM "${table}" WHERE "fixtureVersion"=$1`,[version]);
      assert.equal(rows[0].count,count,`${version} ${table} inventory incomplete`);
    }
  }
  for(let run=1;run<=2;run++){
    execFileSync(process.execPath,['tools/seed.mjs'],{env:{...process.env,DATABASE_URL:connectionString},stdio:'inherit'});
    assert.deepEqual(await snapshot(),before);console.log(`PASS real seed ${run}: counts, payloads, identities and createdAt unchanged`);
  }
  console.log(JSON.stringify(before,null,2));
}finally{await db.end();}
