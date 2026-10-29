import { researchedCities } from './international';
import type { City } from '@torob-ticket/contracts';
// Coordinates and identifiers: assets/provenance.json; labels authored in Persian.
export const cities: City[] = [
  {
    "id": "tehran",
    "name": "تهران",
    "countryCode": "IR",
    "point": {
      "latitude": 35.673889,
      "longitude": 51.422398
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "mashhad",
    "name": "مشهد",
    "countryCode": "IR",
    "point": {
      "latitude": 36.271966,
      "longitude": 59.568051
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "isfahan",
    "name": "اصفهان",
    "countryCode": "IR",
    "point": {
      "latitude": 32.701951,
      "longitude": 51.698092
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "shiraz",
    "name": "شیراز",
    "countryCode": "IR",
    "point": {
      "latitude": 29.631906,
      "longitude": 52.568065
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "tabriz",
    "name": "تبریز",
    "countryCode": "IR",
    "point": {
      "latitude": 38.088237,
      "longitude": 46.2993
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "rasht",
    "name": "رشت",
    "countryCode": "IR",
    "point": {
      "latitude": 37.299983,
      "longitude": 49.629983
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "yazd",
    "name": "یزد",
    "countryCode": "IR",
    "point": {
      "latitude": 31.920053,
      "longitude": 54.370004
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "ahvaz",
    "name": "اهواز",
    "countryCode": "IR",
    "point": {
      "latitude": 31.281934,
      "longitude": 48.718067
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "bandar-abbas",
    "name": "بندرعباس",
    "countryCode": "IR",
    "point": {
      "latitude": 27.20406,
      "longitude": 56.272135
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "kerman",
    "name": "کرمان",
    "countryCode": "IR",
    "point": {
      "latitude": 30.299997,
      "longitude": 57.080019
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "hamadan",
    "name": "همدان",
    "countryCode": "IR",
    "point": {
      "latitude": 34.796027,
      "longitude": 48.515013
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "kermanshah",
    "name": "کرمانشاه",
    "countryCode": "IR",
    "point": {
      "latitude": 34.381952,
      "longitude": 47.058065
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "istanbul",
    "name": "استانبول",
    "countryCode": "TR",
    "point": {
      "latitude": 41.017602,
      "longitude": 28.974277
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "van",
    "name": "وان",
    "countryCode": "TR",
    "point": {
      "latitude": 38.49544,
      "longitude": 43.399976
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "yerevan",
    "name": "ایروان",
    "countryCode": "AM",
    "point": {
      "latitude": 40.183097,
      "longitude": 44.511606
    },
    "timeZone": "Asia/Yerevan"
  },
  {
    "id": "dubai",
    "name": "دبی",
    "countryCode": "AE",
    "point": {
      "latitude": 25.214912,
      "longitude": 55.286946
    },
    "timeZone": "Asia/Dubai"
  },
  {
    "id": "tbilisi",
    "name": "تفلیس",
    "countryCode": "GE",
    "point": {
      "latitude": 41.726956,
      "longitude": 44.78885
    },
    "timeZone": "Asia/Tbilisi"
  },
  {
    "id": "baku",
    "name": "باکو",
    "countryCode": "AZ",
    "point": {
      "latitude": 40.397218,
      "longitude": 49.860271
    },
    "timeZone": "Asia/Baku"
  },
  {
    "id": "ankara",
    "name": "آنکارا",
    "countryCode": "TR",
    "point": {
      "latitude": 39.929184,
      "longitude": 32.862446
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "doha",
    "name": "دوحه",
    "countryCode": "QA",
    "point": {
      "latitude": 25.286556,
      "longitude": 51.532968
    },
    "timeZone": "Asia/Qatar"
  },
  {
    "id": "muscat",
    "name": "مسقط",
    "countryCode": "OM",
    "point": {
      "latitude": 23.585179,
      "longitude": 58.378311
    },
    "timeZone": "Asia/Muscat"
  },
  {
    "id": "moscow",
    "name": "مسکو",
    "countryCode": "RU",
    "point": {
      "latitude": 55.75411,
      "longitude": 37.613577
    },
    "timeZone": "Europe/Moscow"
  },
  ...researchedCities,
  // Authored approximate ground map anchor; no airport or invented transport code.
  {id:'tatvan',name:'تاتوان',countryCode:'TR',point:{latitude:38.497,longitude:42.282},timeZone:'Europe/Istanbul'},
];
