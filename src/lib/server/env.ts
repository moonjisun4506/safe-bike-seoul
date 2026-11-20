import "server-only";

export const serverEnv = {
  get demo() { return process.env.API_DATA_MODE !== "live"; },
  get seoulKey() { return process.env.SEOUL_API_KEY?.trim() || ""; },
  get publicDataKey() { return process.env.DATA_GO_KR_API_KEY?.trim() || ""; },
  get weatherKey() { return process.env.KMA_SERVICE_KEY?.trim() || process.env.DATA_GO_KR_API_KEY?.trim() || ""; },
  get kakaoKey() { return process.env.KAKAO_REST_API_KEY?.trim() || ""; },
};

