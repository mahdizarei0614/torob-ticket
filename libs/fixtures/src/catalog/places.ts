import { researchedPlaces } from './international';
import type { Place } from '@torob-ticket/contracts';
// Airports are sourced; rail/bus locations are explicitly illustrative fictional stops.
export const places: Place[] = [
  {
    "id": "tehran-station",
    "cityId": "tehran",
    "name": "ایستگاه نمونه تهران (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 35.661889,
      "longitude": 51.414398
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "tehran-terminal",
    "cityId": "tehran",
    "name": "پایانه نمونه تهران (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 35.690889,
      "longitude": 51.434398
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "tehran-landmark",
    "cityId": "tehran",
    "name": "مرکز شهر تهران",
    "kind": "landmark",
    "point": {
      "latitude": 35.673889,
      "longitude": 51.422398
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "thr",
    "cityId": "tehran",
    "name": "فرودگاه THR",
    "kind": "airport",
    "code": "THR",
    "point": {
      "latitude": 35.689175,
      "longitude": 51.314392
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "ika",
    "cityId": "tehran",
    "name": "فرودگاه IKA",
    "kind": "airport",
    "code": "IKA",
    "point": {
      "latitude": 35.416099548339844,
      "longitude": 51.152198791503906
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "mashhad-station",
    "cityId": "mashhad",
    "name": "ایستگاه نمونه مشهد (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 36.259966,
      "longitude": 59.560051
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "mashhad-terminal",
    "cityId": "mashhad",
    "name": "پایانه نمونه مشهد (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 36.288966,
      "longitude": 59.580051
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "mashhad-landmark",
    "cityId": "mashhad",
    "name": "مرکز شهر مشهد",
    "kind": "landmark",
    "point": {
      "latitude": 36.271966,
      "longitude": 59.568051
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "mhd",
    "cityId": "mashhad",
    "name": "فرودگاه MHD",
    "kind": "airport",
    "code": "MHD",
    "point": {
      "latitude": 36.234821,
      "longitude": 59.642949
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "isfahan-station",
    "cityId": "isfahan",
    "name": "ایستگاه نمونه اصفهان (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 32.689951,
      "longitude": 51.690092
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "isfahan-terminal",
    "cityId": "isfahan",
    "name": "پایانه نمونه اصفهان (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 32.718951,
      "longitude": 51.710092
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "isfahan-landmark",
    "cityId": "isfahan",
    "name": "مرکز شهر اصفهان",
    "kind": "landmark",
    "point": {
      "latitude": 32.701951,
      "longitude": 51.698092
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "ifn",
    "cityId": "isfahan",
    "name": "فرودگاه IFN",
    "kind": "airport",
    "code": "IFN",
    "point": {
      "latitude": 32.755142,
      "longitude": 51.883877
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "shiraz-station",
    "cityId": "shiraz",
    "name": "ایستگاه نمونه شیراز (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 29.619906,
      "longitude": 52.560065
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "shiraz-terminal",
    "cityId": "shiraz",
    "name": "پایانه نمونه شیراز (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 29.648906,
      "longitude": 52.580065
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "shiraz-landmark",
    "cityId": "shiraz",
    "name": "مرکز شهر شیراز",
    "kind": "landmark",
    "point": {
      "latitude": 29.631906,
      "longitude": 52.568065
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "syz",
    "cityId": "shiraz",
    "name": "فرودگاه SYZ",
    "kind": "airport",
    "code": "SYZ",
    "point": {
      "latitude": 29.5392,
      "longitude": 52.589802
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "tabriz-station",
    "cityId": "tabriz",
    "name": "ایستگاه نمونه تبریز (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 38.076237,
      "longitude": 46.2913
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "tabriz-terminal",
    "cityId": "tabriz",
    "name": "پایانه نمونه تبریز (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 38.105237,
      "longitude": 46.3113
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "tabriz-landmark",
    "cityId": "tabriz",
    "name": "مرکز شهر تبریز",
    "kind": "landmark",
    "point": {
      "latitude": 38.088237,
      "longitude": 46.2993
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "tbz",
    "cityId": "tabriz",
    "name": "فرودگاه TBZ",
    "kind": "airport",
    "code": "TBZ",
    "point": {
      "latitude": 38.1339,
      "longitude": 46.235001
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "rasht-station",
    "cityId": "rasht",
    "name": "ایستگاه نمونه رشت (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 37.287983,
      "longitude": 49.621983
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "rasht-terminal",
    "cityId": "rasht",
    "name": "پایانه نمونه رشت (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 37.316983,
      "longitude": 49.641983
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "rasht-landmark",
    "cityId": "rasht",
    "name": "مرکز شهر رشت",
    "kind": "landmark",
    "point": {
      "latitude": 37.299983,
      "longitude": 49.629983
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "ras",
    "cityId": "rasht",
    "name": "فرودگاه RAS",
    "kind": "airport",
    "code": "RAS",
    "point": {
      "latitude": 37.323333,
      "longitude": 49.617778
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "yazd-station",
    "cityId": "yazd",
    "name": "ایستگاه نمونه یزد (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 31.908053,
      "longitude": 54.362004
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "yazd-terminal",
    "cityId": "yazd",
    "name": "پایانه نمونه یزد (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 31.937053,
      "longitude": 54.382004
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "yazd-landmark",
    "cityId": "yazd",
    "name": "مرکز شهر یزد",
    "kind": "landmark",
    "point": {
      "latitude": 31.920053,
      "longitude": 54.370004
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "azd",
    "cityId": "yazd",
    "name": "فرودگاه AZD",
    "kind": "airport",
    "code": "AZD",
    "point": {
      "latitude": 31.9048995972,
      "longitude": 54.2765007019
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "ahvaz-station",
    "cityId": "ahvaz",
    "name": "ایستگاه نمونه اهواز (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 31.269934,
      "longitude": 48.710067
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "ahvaz-terminal",
    "cityId": "ahvaz",
    "name": "پایانه نمونه اهواز (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 31.298934,
      "longitude": 48.730067
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "ahvaz-landmark",
    "cityId": "ahvaz",
    "name": "مرکز شهر اهواز",
    "kind": "landmark",
    "point": {
      "latitude": 31.281934,
      "longitude": 48.718067
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "awz",
    "cityId": "ahvaz",
    "name": "فرودگاه AWZ",
    "kind": "airport",
    "code": "AWZ",
    "point": {
      "latitude": 31.3364,
      "longitude": 48.763789
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "bandar-abbas-station",
    "cityId": "bandar-abbas",
    "name": "ایستگاه نمونه بندرعباس (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 27.19206,
      "longitude": 56.264135
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "bandar-abbas-terminal",
    "cityId": "bandar-abbas",
    "name": "پایانه نمونه بندرعباس (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 27.22106,
      "longitude": 56.284135
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "bandar-abbas-landmark",
    "cityId": "bandar-abbas",
    "name": "مرکز شهر بندرعباس",
    "kind": "landmark",
    "point": {
      "latitude": 27.20406,
      "longitude": 56.272135
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "bnd",
    "cityId": "bandar-abbas",
    "name": "فرودگاه BND",
    "kind": "airport",
    "code": "BND",
    "point": {
      "latitude": 27.2183,
      "longitude": 56.3778
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "kerman-station",
    "cityId": "kerman",
    "name": "ایستگاه نمونه کرمان (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 30.287997,
      "longitude": 57.072019
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "kerman-terminal",
    "cityId": "kerman",
    "name": "پایانه نمونه کرمان (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 30.316997,
      "longitude": 57.092019
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "kerman-landmark",
    "cityId": "kerman",
    "name": "مرکز شهر کرمان",
    "kind": "landmark",
    "point": {
      "latitude": 30.299997,
      "longitude": 57.080019
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "ker",
    "cityId": "kerman",
    "name": "فرودگاه KER",
    "kind": "airport",
    "code": "KER",
    "point": {
      "latitude": 30.271276,
      "longitude": 56.949692
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "hamadan-station",
    "cityId": "hamadan",
    "name": "ایستگاه نمونه همدان (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 34.784027,
      "longitude": 48.507013
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "hamadan-terminal",
    "cityId": "hamadan",
    "name": "پایانه نمونه همدان (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 34.813027,
      "longitude": 48.527013
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "hamadan-landmark",
    "cityId": "hamadan",
    "name": "مرکز شهر همدان",
    "kind": "landmark",
    "point": {
      "latitude": 34.796027,
      "longitude": 48.515013
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "hdm",
    "cityId": "hamadan",
    "name": "فرودگاه HDM",
    "kind": "airport",
    "code": "HDM",
    "point": {
      "latitude": 34.866416,
      "longitude": 48.56069
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "kermanshah-station",
    "cityId": "kermanshah",
    "name": "ایستگاه نمونه کرمانشاه (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 34.369952,
      "longitude": 47.050065
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "kermanshah-terminal",
    "cityId": "kermanshah",
    "name": "پایانه نمونه کرمانشاه (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 34.398952,
      "longitude": 47.070065
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "kermanshah-landmark",
    "cityId": "kermanshah",
    "name": "مرکز شهر کرمانشاه",
    "kind": "landmark",
    "point": {
      "latitude": 34.381952,
      "longitude": 47.058065
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "ksh",
    "cityId": "kermanshah",
    "name": "فرودگاه KSH",
    "kind": "airport",
    "code": "KSH",
    "point": {
      "latitude": 34.3459014893,
      "longitude": 47.1581001282
    },
    "timeZone": "Asia/Tehran"
  },
  {
    "id": "istanbul-station",
    "cityId": "istanbul",
    "name": "ایستگاه نمونه استانبول (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 41.005602,
      "longitude": 28.966277
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "istanbul-terminal",
    "cityId": "istanbul",
    "name": "پایانه نمونه استانبول (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 41.034602,
      "longitude": 28.986277
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "istanbul-landmark",
    "cityId": "istanbul",
    "name": "مرکز شهر استانبول",
    "kind": "landmark",
    "point": {
      "latitude": 41.017602,
      "longitude": 28.974277
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "ist",
    "cityId": "istanbul",
    "name": "فرودگاه IST",
    "kind": "airport",
    "code": "IST",
    "point": {
      "latitude": 41.274874,
      "longitude": 28.732136
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "saw",
    "cityId": "istanbul",
    "name": "فرودگاه SAW",
    "kind": "airport",
    "code": "SAW",
    "point": {
      "latitude": 40.898602,
      "longitude": 29.3092
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "van-station",
    "cityId": "van",
    "name": "ایستگاه نمونه وان (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 38.48344,
      "longitude": 43.391976
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "van-terminal",
    "cityId": "van",
    "name": "پایانه نمونه وان (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 38.51244,
      "longitude": 43.411976
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "van-landmark",
    "cityId": "van",
    "name": "مرکز شهر وان",
    "kind": "landmark",
    "point": {
      "latitude": 38.49544,
      "longitude": 43.399976
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "van",
    "cityId": "van",
    "name": "فرودگاه VAN",
    "kind": "airport",
    "code": "VAN",
    "point": {
      "latitude": 38.46820068359375,
      "longitude": 43.332298278808594
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "yerevan-station",
    "cityId": "yerevan",
    "name": "ایستگاه نمونه ایروان (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 40.171097,
      "longitude": 44.503606
    },
    "timeZone": "Asia/Yerevan"
  },
  {
    "id": "yerevan-terminal",
    "cityId": "yerevan",
    "name": "پایانه نمونه ایروان (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 40.200097,
      "longitude": 44.523606
    },
    "timeZone": "Asia/Yerevan"
  },
  {
    "id": "yerevan-landmark",
    "cityId": "yerevan",
    "name": "مرکز شهر ایروان",
    "kind": "landmark",
    "point": {
      "latitude": 40.183097,
      "longitude": 44.511606
    },
    "timeZone": "Asia/Yerevan"
  },
  {
    "id": "evn",
    "cityId": "yerevan",
    "name": "فرودگاه EVN",
    "kind": "airport",
    "code": "EVN",
    "point": {
      "latitude": 40.148941,
      "longitude": 44.397887
    },
    "timeZone": "Asia/Yerevan"
  },
  {
    "id": "dubai-station",
    "cityId": "dubai",
    "name": "ایستگاه نمونه دبی (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 25.202912,
      "longitude": 55.278946
    },
    "timeZone": "Asia/Dubai"
  },
  {
    "id": "dubai-terminal",
    "cityId": "dubai",
    "name": "پایانه نمونه دبی (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 25.231912,
      "longitude": 55.298946
    },
    "timeZone": "Asia/Dubai"
  },
  {
    "id": "dubai-landmark",
    "cityId": "dubai",
    "name": "مرکز شهر دبی",
    "kind": "landmark",
    "point": {
      "latitude": 25.214912,
      "longitude": 55.286946
    },
    "timeZone": "Asia/Dubai"
  },
  {
    "id": "dxb",
    "cityId": "dubai",
    "name": "فرودگاه DXB",
    "kind": "airport",
    "code": "DXB",
    "point": {
      "latitude": 25.24979,
      "longitude": 55.370992
    },
    "timeZone": "Asia/Dubai"
  },
  {
    "id": "tbilisi-station",
    "cityId": "tbilisi",
    "name": "ایستگاه نمونه تفلیس (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 41.714956,
      "longitude": 44.78085
    },
    "timeZone": "Asia/Tbilisi"
  },
  {
    "id": "tbilisi-terminal",
    "cityId": "tbilisi",
    "name": "پایانه نمونه تفلیس (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 41.743956,
      "longitude": 44.80085
    },
    "timeZone": "Asia/Tbilisi"
  },
  {
    "id": "tbilisi-landmark",
    "cityId": "tbilisi",
    "name": "مرکز شهر تفلیس",
    "kind": "landmark",
    "point": {
      "latitude": 41.726956,
      "longitude": 44.78885
    },
    "timeZone": "Asia/Tbilisi"
  },
  {
    "id": "tbs",
    "cityId": "tbilisi",
    "name": "فرودگاه TBS",
    "kind": "airport",
    "code": "TBS",
    "point": {
      "latitude": 41.669201,
      "longitude": 44.9547
    },
    "timeZone": "Asia/Tbilisi"
  },
  {
    "id": "baku-station",
    "cityId": "baku",
    "name": "ایستگاه نمونه باکو (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 40.385218,
      "longitude": 49.852271
    },
    "timeZone": "Asia/Baku"
  },
  {
    "id": "baku-terminal",
    "cityId": "baku",
    "name": "پایانه نمونه باکو (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 40.414218,
      "longitude": 49.872271
    },
    "timeZone": "Asia/Baku"
  },
  {
    "id": "baku-landmark",
    "cityId": "baku",
    "name": "مرکز شهر باکو",
    "kind": "landmark",
    "point": {
      "latitude": 40.397218,
      "longitude": 49.860271
    },
    "timeZone": "Asia/Baku"
  },
  {
    "id": "gyd",
    "cityId": "baku",
    "name": "فرودگاه GYD",
    "kind": "airport",
    "code": "GYD",
    "point": {
      "latitude": 40.47278,
      "longitude": 50.050931
    },
    "timeZone": "Asia/Baku"
  },
  {
    "id": "ankara-station",
    "cityId": "ankara",
    "name": "ایستگاه نمونه آنکارا (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 39.917184,
      "longitude": 32.854446
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "ankara-terminal",
    "cityId": "ankara",
    "name": "پایانه نمونه آنکارا (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 39.946184,
      "longitude": 32.874446
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "ankara-landmark",
    "cityId": "ankara",
    "name": "مرکز شهر آنکارا",
    "kind": "landmark",
    "point": {
      "latitude": 39.929184,
      "longitude": 32.862446
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "esb",
    "cityId": "ankara",
    "name": "فرودگاه ESB",
    "kind": "airport",
    "code": "ESB",
    "point": {
      "latitude": 40.128101,
      "longitude": 32.995098
    },
    "timeZone": "Europe/Istanbul"
  },
  {
    "id": "doha-station",
    "cityId": "doha",
    "name": "ایستگاه نمونه دوحه (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 25.274556,
      "longitude": 51.524968
    },
    "timeZone": "Asia/Qatar"
  },
  {
    "id": "doha-terminal",
    "cityId": "doha",
    "name": "پایانه نمونه دوحه (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 25.303556,
      "longitude": 51.544968
    },
    "timeZone": "Asia/Qatar"
  },
  {
    "id": "doha-landmark",
    "cityId": "doha",
    "name": "مرکز شهر دوحه",
    "kind": "landmark",
    "point": {
      "latitude": 25.286556,
      "longitude": 51.532968
    },
    "timeZone": "Asia/Qatar"
  },
  {
    "id": "doh",
    "cityId": "doha",
    "name": "فرودگاه DOH",
    "kind": "airport",
    "code": "DOH",
    "point": {
      "latitude": 25.273056,
      "longitude": 51.608056
    },
    "timeZone": "Asia/Qatar"
  },
  {
    "id": "muscat-station",
    "cityId": "muscat",
    "name": "ایستگاه نمونه مسقط (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 23.573179,
      "longitude": 58.370311
    },
    "timeZone": "Asia/Muscat"
  },
  {
    "id": "muscat-terminal",
    "cityId": "muscat",
    "name": "پایانه نمونه مسقط (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 23.602179,
      "longitude": 58.390311
    },
    "timeZone": "Asia/Muscat"
  },
  {
    "id": "muscat-landmark",
    "cityId": "muscat",
    "name": "مرکز شهر مسقط",
    "kind": "landmark",
    "point": {
      "latitude": 23.585179,
      "longitude": 58.378311
    },
    "timeZone": "Asia/Muscat"
  },
  {
    "id": "mct",
    "cityId": "muscat",
    "name": "فرودگاه MCT",
    "kind": "airport",
    "code": "MCT",
    "point": {
      "latitude": 23.600218,
      "longitude": 58.285268
    },
    "timeZone": "Asia/Muscat"
  },
  {
    "id": "moscow-station",
    "cityId": "moscow",
    "name": "ایستگاه نمونه مسکو (خیالی)",
    "kind": "station",
    "point": {
      "latitude": 55.74211,
      "longitude": 37.605577
    },
    "timeZone": "Europe/Moscow"
  },
  {
    "id": "moscow-terminal",
    "cityId": "moscow",
    "name": "پایانه نمونه مسکو (خیالی)",
    "kind": "terminal",
    "point": {
      "latitude": 55.77111,
      "longitude": 37.625577
    },
    "timeZone": "Europe/Moscow"
  },
  {
    "id": "moscow-landmark",
    "cityId": "moscow",
    "name": "مرکز شهر مسکو",
    "kind": "landmark",
    "point": {
      "latitude": 55.75411,
      "longitude": 37.613577
    },
    "timeZone": "Europe/Moscow"
  },
  {
    "id": "svo",
    "cityId": "moscow",
    "name": "فرودگاه SVO",
    "kind": "airport",
    "code": "SVO",
    "point": {
      "latitude": 55.977486,
      "longitude": 37.386677
    },
    "timeZone": "Europe/Moscow"
  },
  ...researchedPlaces,
  // Technical approximate anchors, not surveyed station entrances.
  {id:'tatvan-station',cityId:'tatvan',name:'ایستگاه تاتوان',kind:'station',point:{latitude:38.501,longitude:42.283},timeZone:'Europe/Istanbul'},
  {id:'tatvan-landmark',cityId:'tatvan',name:'مرکز شهر تاتوان',kind:'landmark',point:{latitude:38.497,longitude:42.282},timeZone:'Europe/Istanbul'},
];
