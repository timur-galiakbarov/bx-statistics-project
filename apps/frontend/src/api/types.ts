export type User = {
  id?: string;
  vkId?: string;
  first_name: string;
  last_name: string;
  userFullName: string;
  photo_200?: string;
  activeTo: string;
  isAdmin: boolean;
};

export type SavedGroup = {
  id: string;
  source: 'free' | 'bookmark' | 'favorite' | 'managed';
  vkGroupId: string;
  name: string;
  photo?: string;
  membersCount?: number;
};

export type VkGroup = {
  id: number;
  name: string;
  screen_name?: string;
  photo_50?: string;
  photo_100?: string;
  photo_200?: string;
  members_count?: number;
};

export type VkListResponse<T> = {
  count: number;
  items: T[];
};

export type DashboardPeriod = 'today' | 'yesterday' | 'last7days' | 'currentMonth';

export type DashboardSummaryItem = {
  savedGroupId: string;
  source: string;
  group: {
    id: number | string;
    name: string;
    screenName?: string;
    photo?: string;
  };
  membersCount: number;
  growth: {
    total: number;
    subscribed: number;
    unsubscribed: number;
  };
  traffic: {
    visitors: number;
    views: number;
  };
  reach: {
    subscribers: number;
    total: number;
  };
  activity: {
    likes: number;
    reposts: number;
    comments: number;
  };
  warnings: string[];
  error: null | {
    code: string;
    message: string;
    vkCode?: number;
  };
};

export type DashboardSummary = {
  period: {
    key: DashboardPeriod;
    dateFrom: string;
    dateTo: string;
  };
  groups: DashboardSummaryItem[];
};

export type VkPermissions = {
  mask: number;
  permissions: Record<string, boolean>;
  requiredForDashboard: {
    groups: boolean;
    stats: boolean;
    wall: boolean;
  };
};

export type VkAppInfo = {
  count?: number;
  items?: Array<{
    id: number;
    title: string;
    type?: string;
    author_id?: number;
    author_url?: string;
    screen_name?: string;
    description?: string;
  }>;
};

export type VkOAuthDebug = {
  clientId: string;
  scope: string;
  forceRevoke: boolean;
  codeRedirectUrl: string;
  implicitRedirectUrl: string;
  codeAuthorizeUrl: string;
  implicitAuthorizeUrl: string;
  productionLegacyAuthorizeUrl: string;
};

export type VkTokenStatus = {
  hasToken: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  scopes: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type VkManualStatsResult = unknown;

export type VkChannelDebug = {
  groupInfo: unknown;
  wall: null | {
    count?: number;
    items?: Array<{
      id?: number;
      date?: number;
      text?: string;
      likes?: { count?: number };
      reposts?: { count?: number };
      comments?: { count?: number };
      views?: { count?: number };
    }>;
  };
  postReach: unknown | null;
  stats: unknown | null;
  warnings: string[];
};

export type AnalyticsPeriod = 'week' | 'twoWeek' | 'month';

export type CommunityAnalytics = {
  period: {
    key: AnalyticsPeriod;
    dateFrom: string;
    dateTo: string;
  };
  group: {
    id: number;
    name: string;
    screenName?: string;
    description?: string;
    photo?: string;
    membersCount: number;
  };
  stats: {
    unavailable: boolean;
    growth: number;
    subscribed: number;
    unsubscribed: number;
    visitors: number;
    views: number;
    reach: number;
    reachSubscribers: number;
  };
  wall: {
    totalPosts: number;
    periodPosts: number;
    actions: number;
    likes: number;
    reposts: number;
    comments: number;
    views: number;
    averageActionsPerPost: number;
    averageActionsPerDay: number;
    averagePostsPerDay: number;
    averageViewsPerPost: number;
    maxViews: number;
    minViews: number;
    adsPosts: number;
    erAverage: number;
    erMax: number;
    dayGroups: Array<{
      date: string;
      posts: number;
      likes: number;
      reposts: number;
      comments: number;
      actions: number;
      views: number;
      er: number;
      averageViews: number;
      averageActionsPerPost: number;
    }>;
    topPosts: Array<{
      id: number;
      date: string;
      text: string;
      url: string;
      media: Array<{
        type: 'photo' | 'video' | 'gif';
        url: string;
        title: string;
      }>;
      likes: number;
      reposts: number;
      comments: number;
      views: number;
      er: number;
      isAd: boolean;
    }>;
  };
  photos: {
    total: number;
    period: number;
    likes: number;
    reposts: number;
    comments: number;
    views: number;
  };
  videos: {
    total: number;
    period: number;
    likes: number;
    reposts: number;
    comments: number;
    views: number;
  };
  warnings: string[];
};

export type CompareItem = {
  groupId: string;
  analytics: CommunityAnalytics | null;
  error: null | {
    code: string;
    message: string;
    vkCode?: number;
  };
};

export type CompareResult = {
  items: CompareItem[];
};

export type PostsAnalysisGroup = {
  groupId: string;
  group: CommunityAnalytics['group'] | null;
  summary: null | {
    totalPosts: number;
    periodPosts: number;
    likes: number;
    reposts: number;
    comments: number;
    views: number;
    actions: number;
    averageActionsPerPost: number;
    averageViewsPerPost: number;
    erAverage: number;
  };
  error: null | {
    code: string;
    message: string;
    vkCode?: number;
  };
};

export type PostsAnalysisPost = {
  id: string;
  vkId: number;
  group: CommunityAnalytics['group'];
  date: string;
  text: string;
  url: string;
  media: Array<{
    type: 'photo' | 'video' | 'gif';
    url: string;
    title: string;
  }>;
  likes: number;
  reposts: number;
  comments: number;
  views: number;
  actions: number;
  er: number;
  isAd: boolean;
};

export type PostsAnalysisResult = {
  period: {
    key: AnalyticsPeriod;
    dateFrom: string;
    dateTo: string;
  };
  groups: PostsAnalysisGroup[];
  posts: PostsAnalysisPost[];
};

export type NewsItem = {
  id: string;
  title: string;
  date: string;
  body: string;
};

export type PaymentPlan = {
  id: 'month' | 'quarter' | 'year';
  title: string;
  months: number;
  priceRub: number;
  monthlyPriceRub: number;
};

export type PaymentIntent = {
  paymentId: string;
  provider: 'yoomoney';
  action: string;
  method: 'POST';
  fields: Record<string, string>;
};

export type PaymentHistoryItem = {
  id: string;
  provider: string;
  amount: number;
  period: string;
  status: 'pending' | 'paid' | 'failed' | string;
  providerTransactionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminPaymentHistoryItem = PaymentHistoryItem & {
  user: null | {
    id: string;
    vkId: string;
    name: string;
    activeTo: string;
  };
};

export type AdminPaymentActionResult = {
  status: string;
  activeTo?: string;
  payment: AdminPaymentHistoryItem | null;
};

export type AdminUserAccessResult = {
  user: {
    id: string;
    vkId: string;
    name: string;
    activeTo: string;
  };
};
