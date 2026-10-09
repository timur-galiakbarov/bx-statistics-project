export type User = {
  id?: string;
  vkId?: string;
  first_name: string;
  last_name: string;
  userFullName: string;
  photo_200?: string;
  activeTo: string;
  trialEndsAt?: string;
  freeGroupsDisabled?: boolean;
  isAdmin: boolean;
  enforceAccessRestrictions: boolean;
};

export type SocialPlatform = 'vk' | 'youtube' | 'telegram';

export type ComparisonCollection = {
  id: string;
  purpose?: 'comparison' | 'posts';
  name: string;
  period: AnalyticsPeriod;
  sources: Array<{ platform: SocialPlatform; externalId: string; name: string; handle?: string; photo?: string; membersCount?: number | null }>;
  updatedAt: string;
};

export type TelegramAnalytics = {
  channel: {
    id: string;
    username: string;
    title: string;
    description: string;
    photo: string;
    subscribers: number | null;
    url: string;
    verified: boolean;
    canViewAdminStats: boolean;
  };
  period: { key: AnalyticsPeriod; dateFrom: string; dateTo: string };
  summary: {
    posts: number;
    views: number;
    reactions: number;
    comments: number;
    forwards: number;
    actions: number;
    averageViews: number;
    averageReachRate: number | null;
    engagementRate: number;
    postsPerWeek: number;
  };
  daily: Array<{ date: string; posts: number; views: number; reactions: number; comments: number; forwards: number }>;
  previous: {
    period: { dateFrom: string; dateTo: string };
    summary: {
      posts: number;
      views: number;
      reactions: number;
      comments: number;
      forwards: number;
      actions: number;
      averageViews: number;
      averageReachRate: number | null;
      engagementRate: number;
      postsPerWeek: number;
    };
    daily: Array<{ date: string; posts: number; views: number; reactions: number; comments: number; forwards: number }>;
    posts: TelegramAnalytics['posts'];
  };
  posts: Array<{
    id: number;
    date: string;
    timestamp: number;
    text: string;
    url: string;
    views: number;
    forwards: number;
    reactions: number;
    comments: number;
    engagement: number;
    mediaType: 'photo' | 'video' | 'document' | 'poll' | 'other' | null;
    mediaUrl?: string;
  }>;
};

export type SocialChannel = {
  platform: SocialPlatform;
  externalId: string;
  name: string;
  handle?: string;
  url: string;
  photo?: string;
  followersCount?: number | null;
};

export type SavedGroup = SocialChannel & {
  id: string;
  source: 'free' | 'bonus' | 'bookmark' | 'favorite' | 'managed';
  isTracked: boolean;
  vkGroupId: string;
  membersCount?: number | null;
};

export type YoutubeChannel = {
  platform: 'youtube';
  id: string;
  externalId: string;
  name: string;
  description: string;
  handle?: string;
  url: string;
  photo?: string;
  followersCount: number | null;
  subscribersHidden: boolean;
  videoCount: number;
  viewCount: number;
};

export type TelegramChannel = {
  platform: 'telegram';
  id: string;
  externalId: string;
  name: string;
  description: string;
  handle: string;
  url: string;
  photo?: string;
  followersCount: number | null;
  verified: boolean;
};

export type VkGroup = {
  id: number;
  name: string;
  screen_name?: string;
  photo_50?: string;
  photo_100?: string;
  photo_200?: string;
  members_count?: number;
  is_admin?: number | boolean;
  is_member?: number | boolean;
  is_subscribed?: number | boolean;
};

export type VkListResponse<T> = {
  count: number;
  items: T[];
};

export type DashboardPeriod = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'last90days' | 'currentMonth' | 'custom';

export type DashboardSummaryItem = {
  savedGroupId: string;
  source: string;
  platform: SocialPlatform;
  group: {
    id: number | string;
    name: string;
    screenName?: string;
    photo?: string;
  };
  membersCount: number | null;
  isManagedByUser: boolean;
  statsAvailable: boolean | null;
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
  /** Прирост подписчиков по ежедневным срезам Socstat (Telegram, YouTube и VK без доступа к статистике). */
  snapshotGrowth: SnapshotGrowth | null;
  warnings: string[];
  error: null | {
    code: string;
    message: string;
    vkCode?: number;
  };
};

export type SnapshotGrowth = {
  total: number | null;
  since: string | null;
  historySince: string | null;
  /** Without access the server hides the number and sends only the direction. */
  locked?: boolean;
  direction?: 'up' | 'down' | 'steady' | null;
};

export type SubscriberHistory = {
  platform: SocialPlatform;
  externalId: string;
  days: number;
  points: Array<{ date: string; subscribers: number | null; change: number | null }>;
  periodGrowth: SnapshotGrowth | null;
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

export type AnalyticsPeriod = 'week' | 'twoWeek' | 'month' | 'currentMonth' | 'previousMonth' | 'custom';

export type CommunityAnalytics = {
  platform?: 'vk' | 'youtube' | 'telegram';
  period: {
    key: AnalyticsPeriod;
    dateFrom: string;
    dateTo: string;
  };
  group: {
    id: number | string;
    platform?: 'vk' | 'youtube' | 'telegram';
    externalId?: string;
    name: string;
    screenName?: string;
    description?: string;
    photo?: string;
    membersCount: number | null;
    url?: string;
    subscribersHidden?: boolean;
    channelViewCount?: number;
    publicVideoCount?: number;
    isManagedByCurrentUser?: boolean;
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
    dayGroups?: Array<{ date: string; dayIndex: number; reach: number | null }>;
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
    medianViewsPerPost?: number;
    availability?: {
      subscribers: boolean;
      views: boolean;
      likes: boolean;
      comments: boolean;
      reposts: boolean;
      er: boolean;
    };
    isComplete: boolean;
    dayGroups: Array<{
      date: string;
      dayIndex: number;
      posts: number;
      likes: number;
      reposts: number;
      comments: number;
      actions: number;
      views: number;
      er: number | null;
      averageViews: number | null;
      averageActionsPerPost: number | null;
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
      contentType: string;
    }>;
  };
  previous: {
    period: {
      dateFrom: string;
      dateTo: string;
    };
    stats: null | {
      growth: number;
      visitors: number;
      reach: number;
      dayGroups?: Array<{ date: string; dayIndex: number; reach: number | null }>;
    };
    wall: CommunityAnalytics['wall'] & { available: boolean };
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
  unavailableMetrics?: Record<string, boolean>;
  /** Present when the user has no access: closed metrics are zeroed by the server. */
  preview?: {
    insights: Array<{ tone: 'good' | 'warn' | 'neutral'; title: string }>;
    hiddenPosts: number;
    snapshotGrowth: SnapshotGrowth | null;
  };
};

export type CompareItem = {
  groupId: string;
  platform?: SocialPlatform;
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
  platform?: SocialPlatform;
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
    type: 'photo' | 'video' | 'gif' | 'document' | 'poll' | 'other';
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
  contentType?: string;
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
  id: 'month' | 'quarter' | 'year' | 'admin-test';
  title: string;
  months?: number;
  days?: number;
  priceRub: number;
  monthlyPriceRub: number;
  durationLabel?: string;
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

export type AdminPaymentsMonthlySummary = {
  current: { count: number; amount: number };
  previous: { count: number; amount: number };
};

export type SnapshotPlatformCoverage = {
  /** null for days before coverage records: only the number of snapshots is known. */
  sources: number | null;
  collected: number;
  postsPending: number;
  stoppedReason: string | null;
};

export type SnapshotDayCoverage = {
  date: string;
  lastPassAt: string | null;
  vk: SnapshotPlatformCoverage | null;
  youtube: SnapshotPlatformCoverage | null;
  telegram: SnapshotPlatformCoverage | null;
};

export type AdminActivitySummary = {
  users: number;
  newUsers: number;
  returningUsers: number;
  visits: number;
  pageViews: number;
  bounceRate: number | null;
  avgVisitSeconds: number | null;
  pagesPerVisit: number | null;
  actions: number;
  groupsAdded: number;
  usersAddedGroups: number;
  payments: number;
  revenue: number;
};

export type AdminActivityDay = {
  date: string;
  users: number;
  newUsers: number;
  visits: number;
  bounces: number;
  groupsAdded: number;
  payments: number;
  revenue: number;
};

export type AdminActivityFeedItem = {
  id: string;
  at: string;
  userId: string;
  userName: string;
  type: string;
  platform?: string;
  label?: string;
  amount?: number;
};

export type AdminActivityStats = {
  days: number;
  trackingSince: string | null;
  periods: Record<'today' | 'yesterday' | 'week' | 'previousWeek' | 'month', AdminActivitySummary>;
  daily: AdminActivityDay[];
  engagement: {
    avgDau7: number;
    mau: number;
    stickiness: number | null;
    avgActiveDays30: number | null;
    visitsPerUser30: number | null;
    returnRate: number | null;
    returnCohort: number;
  };
  funnel: { registered: number; addedGroup: number; usedAnalytics: number; returned: number; paid: number };
  periodPayments: {
    payments: number;
    revenue: number;
    fromCohort: { payments: number; revenue: number };
    firstTime: { payments: number; revenue: number };
    renewals: { payments: number; revenue: number };
  };
  acquisition: Array<{ source: string; campaign: string; registrations: number; addedGroup: number; paid: number }>;
  adReturns: Array<{ label: string; users: number; paid: number; revenue: number }>;
  groups: {
    byPlatform: Array<{ key: string; count: number }>;
    bySource: Array<{ key: string; count: number }>;
    top: Array<{ name: string; platform: string; users: number }>;
  };
  pages: Array<{ path: string; visits: number; users: number; entries: number }>;
  actions: Array<{ type: string; count: number; users: number }>;
  devices: Array<{ key: string; visits: number }>;
  hours: number[];
  feed: AdminActivityFeedItem[];
};

export type AdminUserAccessResult = {
  user: {
    id: string;
    vkId: string;
    name: string;
    activeTo: string;
  };
};

export type RecentAdminUser = {
  id: string;
  bitrixId?: number;
  vkId?: string;
  name: string;
  hasActiveAccess: boolean;
  /** Платил раньше — на странице оплаты видит старые цены. */
  hasLegacyPricing: boolean;
  registeredAt: string;
  lastLoginAt: string;
  lastActivityAt: string;
  activeTo: string;
};

export type AdminActiveUsers = {
  total: number;
  paid: number;
  withoutPayment: number;
  users: Array<RecentAdminUser & { hasPaidPayment: boolean }>;
};

export type PostViewCurves = {
  days: number;
  /** Сколько постов попало в ночные срезы за период. */
  snapshotPosts: number;
  milestones: Array<{ hours: number; median: number | null; posts: number }>;
  curve: Array<{ hours: number; median: number | null; posts: number }>;
  posts: Array<{
    postId: string;
    publishedAt: string;
    latestViews: number | null;
    latestHours: number;
    milestones: Record<string, number | null>;
  }>;
};

export type AdminPreviewStats = {
  days: number;
  viewers: number;
  views: number;
  unlockUsers: number;
  unlockTargets: Array<{ label: string; users: number }>;
  paidUsers: number;
  revenue: number;
};

export type AdminPushStats = {
  days: number;
  subscribedUsers: number;
  subscribedBrowsers: number;
  prompt: { shown: number; accepted: number; subscribed: number; dismissed: number; denied: number };
  reminders: Array<{ kind: string; sent: number; clicked: number; renewed: number; revenue: number }>;
};
