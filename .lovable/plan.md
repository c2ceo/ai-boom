
# AI Content Social Media App

A social media platform exclusively for AI-generated content, combining Instagram-style profiles with a TikTok-style discovery feed. Features built-in AI image generation and an AI content filter.

## 1. Authentication & User Profiles
- Sign up / log in with email (and Google OAuth)
- User profiles with avatar, bio, display name, and follower/following counts
- Profile page showing a grid of the user's AI-generated posts (Instagram-style)
- Edit profile functionality

## 2. Home Feed — TikTok-Style Vertical Scroll
- Full-screen vertical swipe feed for content discovery
- Each card shows the AI image/video, creator info, like count, and comments
- Smooth transitions between posts
- Infinite scroll loading

## 3. Post Creation — Upload & In-App AI Generation
- **Upload mode**: Users can upload AI-generated images and videos from their device
- **AI Generate mode**: Built-in AI image generation using text prompts (powered by Lovable AI / Gemini image model)
- Users add captions, tags, and select content category
- Preview before publishing

## 4. AI Content Filter
- When uploading content, users must tag it as AI-generated and specify the tool used (e.g., Midjourney, DALL-E, Stable Diffusion, in-app)
- In-app generated content is automatically tagged as verified AI content
- Reporting system for users to flag non-AI content
- Moderation queue for flagged posts

## 5. Social Features
- **Follow/Unfollow** users
- **Like** posts with animated heart
- **Comments** on posts with threaded replies
- **Share** posts (copy link)
- **Explore/Discover** page to find new creators and trending AI content
- Notifications for likes, comments, and new followers

## 6. Search & Discovery
- Search by username, caption text, or tags
- Trending/popular content section
- Category filters (e.g., AI Art, AI Photography, AI Video, AI Abstract)
- "For You" algorithmic-style feed based on likes and follows

## 7. Navigation & Layout
- Bottom tab bar: Home (TikTok feed), Explore, Create (+), Notifications, Profile
- Clean, modern dark-themed UI inspired by Instagram/TikTok aesthetics
- Mobile-first responsive design that also works on desktop

## 8. Backend (Lovable Cloud + Supabase)
- Database tables: profiles, posts, likes, comments, follows, notifications, reports
- Storage buckets for uploaded images/videos
- Edge function for AI image generation
- Row-level security for all user data
- Real-time updates for notifications and comments
