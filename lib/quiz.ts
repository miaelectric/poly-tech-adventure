// 스마트 물류 보안 게이트 퀴즈 (docs/PRD.md S3): AI·스마트 팩토리·테크 기초 상식 3지선다

export interface QuizQuestion {
  question: string;
  options: [string, string, string];
  /** options 내 정답 인덱스 */
  answer: number;
}

const POOL: QuizQuestion[] = [
  { question: "공장 설비와 기기를 인터넷으로 연결하는 기술은?", options: ["IoT (사물인터넷)", "VR (가상현실)", "NFT (대체불가토큰)"], answer: 0 },
  { question: "스스로 이동하며 물건을 옮기는 무인운반로봇의 약자는?", options: ["AGV", "GPU", "LAN"], answer: 0 },
  { question: "현실 설비를 가상 공간에 똑같이 복제해 시뮬레이션하는 기술은?", options: ["블록체인", "디지털 트윈", "클라우드 백업"], answer: 1 },
  { question: "물류 상자에 붙은 막대 무늬를 읽는 장치는?", options: ["온도 센서", "스피커", "바코드 스캐너"], answer: 2 },
  { question: "AI가 데이터로부터 스스로 규칙을 학습하는 방법은?", options: ["머신러닝", "하드코딩", "오버클럭"], answer: 0 },
  { question: "전파로 접촉 없이 태그 정보를 읽는 물류 기술은?", options: ["HDMI", "RFID", "PDF"], answer: 1 },
  { question: "사람 곁에서 안전하게 함께 일하도록 만든 협동 로봇은?", options: ["드론", "서버", "코봇 (Cobot)"], answer: 2 },
  { question: "데이터를 기기 가까이에서 바로 처리하는 컴퓨팅 방식은?", options: ["엣지 컴퓨팅", "메인프레임", "배치 처리"], answer: 0 },
  { question: "설비 고장을 미리 예측해 정비하는 것을 무엇이라 할까요?", options: ["사후 보전", "예지 보전", "수동 보전"], answer: 1 },
  { question: "방대한 텍스트로 학습한 대화형 AI 모델을 부르는 말은?", options: ["대규모 언어 모델 (LLM)", "관계형 DB", "운영체제"], answer: 0 },
  { question: "카메라 영상으로 불량품을 찾아내는 AI 분야는?", options: ["음성 합성", "암호화폐", "컴퓨터 비전"], answer: 2 },
  { question: "창고의 입고·재고·출고를 관리하는 시스템의 약자는?", options: ["CPU", "WMS", "URL"], answer: 1 },
  { question: "1바이트(Byte)는 몇 비트(bit)일까요?", options: ["4비트", "8비트", "16비트"], answer: 1 },
  { question: "AI 학습 데이터에 정답 표시를 붙이는 작업은?", options: ["데이터 라벨링", "디버깅", "렌더링"], answer: 0 },
  { question: "산업용 제어 장치 PLC의 'C'가 뜻하는 것은?", options: ["Cable", "Computer", "Controller"], answer: 2 },
  { question: "사람의 뇌 신경 구조를 본떠 만든 AI 모델은?", options: ["인공신경망", "스프레드시트", "방화벽"], answer: 0 },
];

/** 보안 게이트 섹터: 30, 50, 80, 이후 50 섹터마다 */
export function gateAfter(score: number): number {
  for (const g of [30, 50, 80]) if (g > score) return g;
  return 80 + (Math.floor((score - 80) / 50) + 1) * 50;
}

/** 이번 판에서 아직 안 나온 문제를 고르고 보기 순서를 섞는다 */
export function pickQuestion(used: Set<number>): QuizQuestion {
  if (used.size >= POOL.length) used.clear();
  let i = Math.floor(Math.random() * POOL.length);
  while (used.has(i)) i = (i + 1) % POOL.length;
  used.add(i);
  const q = POOL[i];
  const order = [0, 1, 2].sort(() => Math.random() - 0.5);
  return {
    question: q.question,
    options: order.map((k) => q.options[k]) as [string, string, string],
    answer: order.indexOf(q.answer),
  };
}
