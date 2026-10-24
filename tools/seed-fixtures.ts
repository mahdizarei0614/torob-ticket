import type { PrismaClient, Prisma } from '@torob-ticket/data-access';
import { catalog, fixtureIdentity, hotels, roomRateTemplates } from '@torob-ticket/fixtures';
const json=(value:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(value));
/** Insert only; the entire immutable version is committed atomically. Reseeding never updates it. */
export async function seedFixtures(db:PrismaClient) {
  await db.$transaction(async tx=>{
    await tx.fixtureVersion.createMany({data:[{id:fixtureIdentity.fixtureVersion,catalogRevision:fixtureIdentity.catalogRevision,manifest:json({catalog,fictional:true,sourceRevision:'source-v1',hotelCount:hotels.length,rateCount:roomRateTemplates.length}),createdAt:new Date('2026-10-24T00:00:00.000Z')}],skipDuplicates:true});
    await tx.place.createMany({data:catalog.places.map(place=>({fixtureVersion:fixtureIdentity.fixtureVersion,id:place.id,payload:json(place)})),skipDuplicates:true});
    await tx.hotel.createMany({data:hotels.map(hotel=>({fixtureVersion:fixtureIdentity.fixtureVersion,id:hotel.hotelId,payload:json(hotel)})),skipDuplicates:true});
    await tx.roomRate.createMany({data:roomRateTemplates.map(rate=>({fixtureVersion:fixtureIdentity.fixtureVersion,hotelId:rate.hotelId,id:rate.roomRateId,payload:json(rate)})),skipDuplicates:true});
  },{timeout:30000});
}
