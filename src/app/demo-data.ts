export const places = [
  { id: 1, name: "여의나루역", address: "서울 영등포구 여의동로 343", lat: 37.5271, lng: 126.9328, x: 28, y: 66 },
  { id: 2, name: "반포한강공원", address: "서울 서초구 신반포로11길 40", lat: 37.5097, lng: 126.9959, x: 77, y: 48 },
  { id: 3, name: "여의도한강공원", address: "서울 영등포구 여의동로 330", lat: 37.5295, lng: 126.934, x: 32, y: 59 },
  { id: 4, name: "뚝섬한강공원", address: "서울 광진구 강변북로 139", lat: 37.5305, lng: 127.066, x: 91, y: 29 },
];
export type Place = (typeof places)[number];



