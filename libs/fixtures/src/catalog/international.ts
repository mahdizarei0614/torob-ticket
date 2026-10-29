import type { City, Place } from '@torob-ticket/contracts';
// Airport identifiers/anchors: public-domain OurAirports snapshot 2026-10-29.
// City anchors: bundled Natural Earth; Frankfurt center is an authored approximate map anchor.
// Source hash/observations and IANA zones: docs/evidence/adjustments/realistic-travel-catalog/.
export const researchedCities: City[] = [
  {
    "id": "london",
    "name": "لندن",
    "countryCode": "GB",
    "point": {
      "longitude": -0.118668,
      "latitude": 51.501941
    },
    "timeZone": "Europe/London"
  },
  {
    "id": "paris",
    "name": "پاریس",
    "countryCode": "FR",
    "point": {
      "longitude": 2.352992,
      "latitude": 48.858092
    },
    "timeZone": "Europe/Paris"
  },
  {
    "id": "frankfurt",
    "name": "فرانکفورت",
    "countryCode": "DE",
    "point": {
      "latitude": 50.1109,
      "longitude": 8.6821
    },
    "timeZone": "Europe/Berlin"
  },
  {
    "id": "new-york",
    "name": "نیویورک",
    "countryCode": "US",
    "point": {
      "longitude": -73.995718,
      "latitude": 40.721562
    },
    "timeZone": "America/New_York"
  },
  {
    "id": "los-angeles",
    "name": "لس‌آنجلس",
    "countryCode": "US",
    "point": {
      "longitude": -118.231986,
      "latitude": 34.049219
    },
    "timeZone": "America/Los_Angeles"
  },
  {
    "id": "toronto",
    "name": "تورنتو",
    "countryCode": "CA",
    "point": {
      "longitude": -79.389459,
      "latitude": 43.664645
    },
    "timeZone": "America/Toronto"
  },
  {
    "id": "singapore",
    "name": "سنگاپور",
    "countryCode": "SG",
    "point": {
      "longitude": 103.853875,
      "latitude": 1.294979
    },
    "timeZone": "Asia/Singapore"
  },
  {
    "id": "bangkok",
    "name": "بانکوک",
    "countryCode": "TH",
    "point": {
      "longitude": 100.514699,
      "latitude": 13.751945
    },
    "timeZone": "Asia/Bangkok"
  },
  {
    "id": "tokyo",
    "name": "توکیو",
    "countryCode": "JP",
    "point": {
      "longitude": 139.749462,
      "latitude": 35.686963
    },
    "timeZone": "Asia/Tokyo"
  },
  {
    "id": "sydney",
    "name": "سیدنی",
    "countryCode": "AU",
    "point": {
      "longitude": 151.212548,
      "latitude": -33.871373
    },
    "timeZone": "Australia/Sydney"
  },
  {
    "id": "auckland",
    "name": "اوکلند",
    "countryCode": "NZ",
    "point": {
      "longitude": 174.763027,
      "latitude": -36.848055
    },
    "timeZone": "Pacific/Auckland"
  }
];
export const researchedPlaces: Place[] = [
  {
    "id": "lhr",
    "cityId": "london",
    "name": "فرودگاه هیترو",
    "kind": "airport",
    "code": "LHR",
    "point": {
      "latitude": 51.470748,
      "longitude": -0.459909
    },
    "timeZone": "Europe/London"
  },
  {
    "id": "london-landmark",
    "cityId": "london",
    "name": "مرکز شهر لندن",
    "kind": "landmark",
    "point": {
      "longitude": -0.118668,
      "latitude": 51.501941
    },
    "timeZone": "Europe/London"
  },
  {
    "id": "cdg",
    "cityId": "paris",
    "name": "فرودگاه شارل دوگل",
    "kind": "airport",
    "code": "CDG",
    "point": {
      "latitude": 49.00896,
      "longitude": 2.554117
    },
    "timeZone": "Europe/Paris"
  },
  {
    "id": "paris-landmark",
    "cityId": "paris",
    "name": "مرکز شهر پاریس",
    "kind": "landmark",
    "point": {
      "longitude": 2.352992,
      "latitude": 48.858092
    },
    "timeZone": "Europe/Paris"
  },
  {
    "id": "fra",
    "cityId": "frankfurt",
    "name": "فرودگاه فرانکفورت",
    "kind": "airport",
    "code": "FRA",
    "point": {
      "latitude": 50.026706,
      "longitude": 8.55835
    },
    "timeZone": "Europe/Berlin"
  },
  {
    "id": "frankfurt-landmark",
    "cityId": "frankfurt",
    "name": "مرکز شهر فرانکفورت",
    "kind": "landmark",
    "point": {
      "latitude": 50.1109,
      "longitude": 8.6821
    },
    "timeZone": "Europe/Berlin"
  },
  {
    "id": "jfk",
    "cityId": "new-york",
    "name": "فرودگاه جان اف کندی",
    "kind": "airport",
    "code": "JFK",
    "point": {
      "latitude": 40.639447,
      "longitude": -73.779317
    },
    "timeZone": "America/New_York"
  },
  {
    "id": "new-york-landmark",
    "cityId": "new-york",
    "name": "مرکز شهر نیویورک",
    "kind": "landmark",
    "point": {
      "longitude": -73.995718,
      "latitude": 40.721562
    },
    "timeZone": "America/New_York"
  },
  {
    "id": "lax",
    "cityId": "los-angeles",
    "name": "فرودگاه لس‌آنجلس",
    "kind": "airport",
    "code": "LAX",
    "point": {
      "latitude": 33.942501,
      "longitude": -118.407997
    },
    "timeZone": "America/Los_Angeles"
  },
  {
    "id": "los-angeles-landmark",
    "cityId": "los-angeles",
    "name": "مرکز شهر لس‌آنجلس",
    "kind": "landmark",
    "point": {
      "longitude": -118.231986,
      "latitude": 34.049219
    },
    "timeZone": "America/Los_Angeles"
  },
  {
    "id": "yyz",
    "cityId": "toronto",
    "name": "فرودگاه پیرسون تورنتو",
    "kind": "airport",
    "code": "YYZ",
    "point": {
      "latitude": 43.675935,
      "longitude": -79.629421
    },
    "timeZone": "America/Toronto"
  },
  {
    "id": "toronto-landmark",
    "cityId": "toronto",
    "name": "مرکز شهر تورنتو",
    "kind": "landmark",
    "point": {
      "longitude": -79.389459,
      "latitude": 43.664645
    },
    "timeZone": "America/Toronto"
  },
  {
    "id": "sin",
    "cityId": "singapore",
    "name": "فرودگاه چانگی",
    "kind": "airport",
    "code": "SIN",
    "point": {
      "latitude": 1.35019,
      "longitude": 103.994003
    },
    "timeZone": "Asia/Singapore"
  },
  {
    "id": "singapore-landmark",
    "cityId": "singapore",
    "name": "مرکز شهر سنگاپور",
    "kind": "landmark",
    "point": {
      "longitude": 103.853875,
      "latitude": 1.294979
    },
    "timeZone": "Asia/Singapore"
  },
  {
    "id": "bkk",
    "cityId": "bangkok",
    "name": "فرودگاه سووارنابومی",
    "kind": "airport",
    "code": "BKK",
    "point": {
      "latitude": 13.6811,
      "longitude": 100.747002
    },
    "timeZone": "Asia/Bangkok"
  },
  {
    "id": "bangkok-landmark",
    "cityId": "bangkok",
    "name": "مرکز شهر بانکوک",
    "kind": "landmark",
    "point": {
      "longitude": 100.514699,
      "latitude": 13.751945
    },
    "timeZone": "Asia/Bangkok"
  },
  {
    "id": "hnd",
    "cityId": "tokyo",
    "name": "فرودگاه هانه‌دا",
    "kind": "airport",
    "code": "HND",
    "point": {
      "latitude": 35.549678,
      "longitude": 139.786958
    },
    "timeZone": "Asia/Tokyo"
  },
  {
    "id": "tokyo-landmark",
    "cityId": "tokyo",
    "name": "مرکز شهر توکیو",
    "kind": "landmark",
    "point": {
      "longitude": 139.749462,
      "latitude": 35.686963
    },
    "timeZone": "Asia/Tokyo"
  },
  {
    "id": "syd",
    "cityId": "sydney",
    "name": "فرودگاه کینگزفورد اسمیت",
    "kind": "airport",
    "code": "SYD",
    "point": {
      "latitude": -33.946098,
      "longitude": 151.177002
    },
    "timeZone": "Australia/Sydney"
  },
  {
    "id": "sydney-landmark",
    "cityId": "sydney",
    "name": "مرکز شهر سیدنی",
    "kind": "landmark",
    "point": {
      "longitude": 151.212548,
      "latitude": -33.871373
    },
    "timeZone": "Australia/Sydney"
  },
  {
    "id": "akl",
    "cityId": "auckland",
    "name": "فرودگاه اوکلند",
    "kind": "airport",
    "code": "AKL",
    "point": {
      "latitude": -37.01199,
      "longitude": 174.786331
    },
    "timeZone": "Pacific/Auckland"
  },
  {
    "id": "auckland-landmark",
    "cityId": "auckland",
    "name": "مرکز شهر اوکلند",
    "kind": "landmark",
    "point": {
      "longitude": 174.763027,
      "latitude": -36.848055
    },
    "timeZone": "Pacific/Auckland"
  }
];
