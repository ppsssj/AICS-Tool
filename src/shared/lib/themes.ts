export type AppTheme = 'silver' | 'mist' | 'sky' | 'sand';

export interface AppThemeOption {
  id: AppTheme;
  label: string;
  description: string;
  swatches: [string, string, string];
}

export const appThemeOptions: AppThemeOption[] = [
  {
    id: 'silver',
    label: '실버 시스템',
    description: '중성적인 실버 톤의 기본 작업 환경',
    swatches: ['#f4f6f8', '#dde6f2', '#6f88bc'],
  },
  {
    id: 'mist',
    label: '미스트',
    description: '차분한 쿨 그레이와 푸른 안개 톤',
    swatches: ['#f2f5f7', '#d7e2e8', '#6f8da0'],
  },
  {
    id: 'sky',
    label: '스카이',
    description: '은은한 하늘빛이 감도는 밝은 생산성 테마',
    swatches: ['#f3f7fb', '#d8e8f6', '#5f89be'],
  },
  {
    id: 'sand',
    label: '샌드',
    description: '따뜻한 샌드 베이스의 부드러운 라이트 테마',
    swatches: ['#f7f3ee', '#eadfce', '#b48662'],
  },
];
