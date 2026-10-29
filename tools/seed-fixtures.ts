import type { PrismaClient, Prisma } from '@torob-ticket/data-access';
import { fixtureBundles } from '@torob-ticket/fixtures';
const json=(value:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(value));
/** Insert only; the entire immutable version is committed atomically. Reseeding never updates it. */
export async function seedFixtures(db:PrismaClient) {
  await db.$transaction(async tx=>{
    for (const { identity, catalog, hotels, roomRateTemplates, sourceRevision, createdAt } of fixtureBundles) {
      await tx.fixtureVersion.createMany({data:[{id:identity.fixtureVersion,catalogRevision:identity.catalogRevision,manifest:json({catalog,fictional:true,sourceRevision,hotelCount:hotels.length,rateCount:roomRateTemplates.length}),createdAt:new Date(createdAt)}],skipDuplicates:true});
      await tx.place.createMany({data:catalog.places.map(place=>({fixtureVersion:identity.fixtureVersion,id:place.id,payload:json(place)})),skipDuplicates:true});
      await tx.hotel.createMany({data:hotels.map(hotel=>({fixtureVersion:identity.fixtureVersion,id:hotel.hotelId,payload:json(hotel)})),skipDuplicates:true});
      await tx.roomRate.createMany({data:roomRateTemplates.map(rate=>({fixtureVersion:identity.fixtureVersion,hotelId:rate.hotelId,id:rate.roomRateId,payload:json(rate)})),skipDuplicates:true});
    }
  },{timeout:30000});
  return fixtureBundles.map(({identity,catalog,hotels,roomRateTemplates})=>({...identity,places:catalog.places.length,hotels:hotels.length,roomTemplates:roomRateTemplates.length}));
}
