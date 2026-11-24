import {
  Activity,
  BarChart3,
  Eye,
  ExternalLink,
  FileText,
  Forward,
  Heart,
  Image,
  MessageCircle,
  Bookmark,
  EyeOff,
  MousePointerClick,
  UserPlus,
  Play,
  Repeat2,
  SmilePlus,
  Users
} from 'lucide-react';
import type { CommunityAnalytics } from '../api/types';

type PostMedia = {
  type: 'photo' | 'video' | 'gif' | 'document' | 'poll' | 'other';
  url: string;
  title: string;
};

export type PostCardData = {
  id: string | number;
  group: CommunityAnalytics['group'];
  date: string;
  text: string;
  url: string;
  media: PostMedia[];
  likes: number | null;
  reposts: number | null;
  comments: number | null;
  views: number | null;
  er: number | null;
  isAd: boolean;
  contentType?: string;
  resultBadge?: string;
  resultReason?: string;
  /** Есть только у VK-сообществ с доступом к статистике. */
  reach?: number | null;
  bookmarks?: number | null;
  hides?: number | null;
  subscriptions?: number | null;
  linkClicks?: number | null;
};

type Props = {
  post: PostCardData;
};

function formatNumber(value: number | null) {
  return value === null ? 'Недоступно' : new Intl.NumberFormat('ru-RU').format(value);
}

function getPostPreview(post: PostCardData) {
  return post.media[0];
}

export function PostCard({ post }: Props) {
  const preview = getPostPreview(post);
  const extraMetrics = [
    { key: 'reach', label: 'Охват', value: post.reach, icon: Users },
    { key: 'bookmarks', label: 'Сохранения', value: post.bookmarks, icon: Bookmark },
    { key: 'hides', label: 'Скрытия', value: post.hides, icon: EyeOff },
    { key: 'linkClicks', label: 'Клики по ссылке', value: post.linkClicks, icon: MousePointerClick },
    { key: 'subscriptions', label: 'Подписки с поста', value: post.subscriptions, icon: UserPlus }
  // Охват показываем всегда, когда он есть; сохранения, скрытия, клики и подписки — только если они не нулевые:
  // ряд из пяти нулей на каждой карточке читается хуже, чем отсутствие события.
  ].filter((metric): metric is { key: string; label: string; value: number; icon: typeof Eye } => typeof metric.value === 'number' && (metric.key === 'reach' ? metric.value >= 0 : metric.value > 0));
  const isTelegram = post.group.platform === 'telegram';
  const PreviewIcon = preview?.type === 'video' ? Play : preview?.type === 'document' ? FileText : Image;

  return (
    <article className={`post-card ${isTelegram ? 'telegram-post-card' : ''}`}>
      <div className={`post-card-media ${isTelegram ? 'telegram-post-card-media' : ''}`}>
        {preview ? (
          <>
            {preview.url ? <img src={preview.url} alt="" /> : <div className="post-card-media-empty"><PreviewIcon size={34} /></div>}
            {preview.type !== 'photo' && (
              <span className="post-media-kind">
                <PreviewIcon size={15} />
                {preview.title}
              </span>
            )}
            {post.media.length > 1 && <span className="post-media-count">+{post.media.length - 1}</span>}
          </>
        ) : (
          <div className="post-card-media-empty">
            <BarChart3 size={26} />
          </div>
        )}
      </div>

      <div className="post-card-body">
        <div className="post-card-header">
          <span className="post-group-mini">
            {post.group.photo ? <img src={post.group.photo} alt="" /> : <span className="community-avatar-placeholder post-group-mini-placeholder" />}
            <span>
              <strong>{post.group.name}</strong>
              <small>{new Date(post.date).toLocaleString('ru-RU')}</small>
            </span>
          </span>
          {post.url && <a className="icon-button" href={post.url} rel="noreferrer" target="_blank" aria-label="Открыть публикацию">
            <ExternalLink size={17} />
          </a>}
        </div>

        <div className="post-card-tags">
          <span>{post.contentType ?? (preview ? preview.title : 'Текст')}</span>
          {isTelegram
            ? <span className="telegram-public-badge">Публичные данные</span>
            : post.group.platform !== 'youtube' && <span className={post.isAd ? 'post-ad-badge' : 'post-organic-badge'}>{post.isAd ? 'Реклама' : 'Органический'}</span>}
          {post.resultBadge && <strong className="post-result-badge">{post.resultBadge}</strong>}
        </div>

        <p>{post.text || 'Без текста'}</p>

        {post.resultReason && <small className="post-result-reason">{post.resultReason}</small>}

        <div className="post-metrics">
          <span title={isTelegram ? 'Реакции' : 'Лайки'} aria-label={`${isTelegram ? 'Реакции' : 'Лайки'}: ${formatNumber(post.likes)}`}>
            {isTelegram ? <SmilePlus size={15} /> : <Heart size={15} />}
            {formatNumber(post.likes)}
          </span>
          {post.group.platform !== 'youtube' && <span title={isTelegram ? 'Пересылки' : 'Репосты'} aria-label={`${isTelegram ? 'Пересылки' : 'Репосты'}: ${formatNumber(post.reposts)}`}>
            {isTelegram ? <Forward size={15} /> : <Repeat2 size={15} />}
            {formatNumber(post.reposts)}
          </span>}
          <span title="Комментарии" aria-label={`Комментарии: ${formatNumber(post.comments)}`}>
            <MessageCircle size={15} />
            {formatNumber(post.comments)}
          </span>
          <span title="Просмотры" aria-label={`Просмотры: ${formatNumber(post.views)}`}>
            <Eye size={15} />
            {formatNumber(post.views)}
          </span>
          <span title={post.group.platform === 'youtube' || isTelegram ? 'Вовлечённость по просмотрам' : 'ER'} aria-label={`Вовлечённость: ${post.er === null ? 'недоступно' : formatEr(post.er)}`}>
            <Activity size={15} />
            {post.er === null ? 'Недоступно' : formatEr(post.er)}
          </span>
        </div>
        {extraMetrics.length > 0 && <div className="post-card-extra">
          {extraMetrics.map(({ key, label, value, icon: Icon }) => (
            <span key={key} title={label} aria-label={`${label}: ${formatNumber(value)}`}>
              <Icon size={13} />
              <small>{label}</small>
              <b>{formatNumber(value)}</b>
            </span>
          ))}
        </div>}
      </div>
    </article>
  );
}

function formatEr(value: number) {
  // Маленький ER (доли процента у больших сообществ) показываем с тремя знаками, чтобы не превращать его в 0%.
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: Math.abs(value) < 1 ? 3 : 2 }).format(value)}%`;
}
