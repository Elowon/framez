// src/screens/HomeScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";
import { Ionicons } from "@expo/vector-icons";

interface Post {
  id: string;
  user_id: string;
  text: string;
  image_url: string;
  created_at: string;
  username?: string;
  avatar_url?: string;
  likes_count: number;
  is_liked: boolean;
  comments_count: number;
}

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string;
  full_name?: string;
  name?: string;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  username?: string;
  avatar_url?: string;
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isFocused = useIsFocused();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [currentUserProfile, setCurrentUserProfile] =
    useState<UserProfile | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [imageLoadAttempts, setImageLoadAttempts] = useState<{
    [key: string]: number;
  }>({});
  const [imageLoading, setImageLoading] = useState<{ [key: string]: boolean }>(
    {}
  );

  // Comments state
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  // ROBUST image URL fix - removes "Loading:" prefix and adds cache busting
  const fixImageUrl = useCallback((url: string | null | undefined): string | null => {
    if (!url) {
      console.log("❌ No URL provided to fixImageUrl");
      return null;
    }

    console.log("🖼️ Original URL:", url);

    // Remove any "Loading:" prefix (case insensitive, with or without space)
    let cleanUrl = url;
    if (url.toLowerCase().includes('loading:')) {
      cleanUrl = url.replace(/loading:\s*/i, '');
      console.log("🖼️ Cleaned URL after removing 'Loading:':", cleanUrl);
    }

    // Add cache busting
    const separator = cleanUrl.includes('?') ? '&' : '?';
    const finalUrl = cleanUrl + `${separator}t=${Date.now()}`;
    console.log("🖼️ Final URL with cache busting:", finalUrl);

    return finalUrl;
  }, []);

  // Enhanced image error handler with retry logic
  const handleImageError = useCallback(
    (imageUrl: string, postId: string) => {
      console.log(`❌ IMAGE FAILED TO LOAD: ${imageUrl}`);
      console.log(`Post ID: ${postId}`);

      const attempts = imageLoadAttempts[imageUrl] || 0;

      console.log(`Attempt ${attempts + 1} failed for:`, imageUrl);

      // Update attempt count
      setImageLoadAttempts((prev) => ({
        ...prev,
        [imageUrl]: attempts + 1,
      }));

      // Add to failed images if we've tried multiple times
      if (attempts >= 2) {
        console.log(`🚫 Giving up on image after 3 attempts: ${imageUrl}`);
        setFailedImages((prev) => new Set(prev).add(imageUrl));
      }

      // Remove from loading state
      setImageLoading((prev) => ({ ...prev, [imageUrl]: false }));
    },
    [imageLoadAttempts]
  );

  const handleImageLoad = useCallback((imageUrl: string) => {
    console.log(`✅ IMAGE LOADED SUCCESSFULLY: ${imageUrl}`);
    setImageLoading((prev) => ({ ...prev, [imageUrl]: false }));
  }, []);

  const handleImageLoadStart = useCallback((imageUrl: string) => {
    console.log(`🔄 IMAGE STARTED LOADING: ${imageUrl}`);
    setImageLoading((prev) => ({ ...prev, [imageUrl]: true }));
  }, []);

  // FIXED: Fetch current user's profile with proper error handling
  // Fetch current user's profile - FIXED VERSION
const fetchCurrentUserProfile = useCallback(async () => {
  if (!user) return;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, full_name, name")
      .eq("id", user.id)
      .limit(1);

    if (error) {
      console.error("Error fetching current user profile:", error);
      return;
    }

    // Check if we got any results
    if (data && data.length > 0) {
      setCurrentUserProfile(data[0]);
      console.log("✅ Current user profile:", data[0]);
    } else {
      console.log("ℹ️ No profile found for user - this is normal for new users");
      setCurrentUserProfile(null);
    }
  } catch (error) {
    console.error("Error in fetchCurrentUserProfile:", error);
    setCurrentUserProfile(null);
  }
}, [user]);

  // PERSISTENT LIKE FUNCTION - saves to database
  const handleLike = useCallback(async (postId: string, currentlyLiked: boolean) => {
    if (!user) return;

    try {
      if (currentlyLiked) {
        // Unlike - remove from database
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Like - add to database
        const { error } = await supabase
          .from('likes')
          .insert({
            post_id: postId,
            user_id: user.id
          });
        
        if (error) throw error;
      }

      // Update local state
      setPosts(posts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              is_liked: !currentlyLiked,
              likes_count: currentlyLiked ? post.likes_count - 1 : post.likes_count + 1
            }
          : post
      ));
    } catch (error) {
      console.error('Error updating like:', error);
    }
  }, [user, posts]);

  // COMMENTS FUNCTIONS
  const openComments = useCallback(async (post: Post) => {
    setSelectedPost(post);
    setCommentsModalVisible(true);
    setCommentsLoading(true);
    
    try {
      await fetchComments(post.id);
    } catch (error) {
      console.error('Error opening comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const fetchComments = useCallback(async (postId: string) => {
    try {
      const { data: commentsData, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles!inner(
            username,
            avatar_url,
            full_name
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        return;
      }

      // Transform the data to include user info
      const formattedComments: Comment[] = commentsData?.map(comment => ({
        id: comment.id,
        post_id: comment.post_id,
        user_id: comment.user_id,
        text: comment.text,
        created_at: comment.created_at,
        username: comment.profiles?.username || `user_${comment.user_id.slice(0, 8)}`,
        avatar_url: comment.profiles?.avatar_url
      })) || [];

      setComments(formattedComments);
      console.log(`💬 Loaded ${formattedComments.length} comments for post ${postId}`);
    } catch (error) {
      console.error('Error in fetchComments:', error);
    }
  }, []);

  const postComment = useCallback(async () => {
    if (!user || !selectedPost || !newComment.trim()) return;

    setPostingComment(true);
    
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: selectedPost.id,
          user_id: user.id,
          text: newComment.trim()
        })
        .select();

      if (error) throw error;

      // Clear input and refresh comments
      setNewComment('');
      await fetchComments(selectedPost.id);
      
      // Update post comments count
      setPosts(posts.map(post => 
        post.id === selectedPost.id 
          ? { ...post, comments_count: (post.comments_count || 0) + 1 }
          : post
      ));

      console.log('✅ Comment posted successfully');
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setPostingComment(false);
    }
  }, [user, selectedPost, newComment, posts, fetchComments]);

  // UPDATED Fetch posts function with comments count
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    console.log("🔄 Starting to fetch posts...");

    try {
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (postsError) {
        console.error("❌ Error fetching posts:", postsError);
        setPosts([]);
        return;
      }

      console.log(`📝 Found ${postsData?.length || 0} posts`);

      if (!postsData || postsData.length === 0) {
        console.log("📝 No posts found");
        setPosts([]);
        return;
      }

      // Get user profiles for each post
      const userIds = [...new Set(postsData.map((post) => post.user_id))];
      console.log("👥 User IDs in posts:", userIds);

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, full_name, name")
        .in("id", userIds);

      if (profilesError) {
        console.error("❌ Error fetching profiles:", profilesError);
      } else {
        console.log(`👥 Found ${profilesData?.length || 0} profiles`);
      }

      // ROBUST likes fetching with error handling
      let userLikes = null;
      let likesCounts = null;
      
      try {
        // Get likes data for current user
        const likesResponse = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user?.id);
        
        if (likesResponse.error) {
          console.error("❌ Error fetching user likes:", likesResponse.error);
        } else {
          userLikes = likesResponse.data;
          console.log(`❤️ Found ${userLikes?.length || 0} user likes`);
        }
      } catch {
        console.log("⚠️ Likes table not available yet, using empty data");
        userLikes = [];
      }

      try {
        // Get likes count for each post
        const countsResponse = await supabase
          .from('likes')
          .select('post_id')
          .in('post_id', postsData.map(p => p.id));
        
        if (countsResponse.error) {
          console.error("❌ Error fetching likes counts:", countsResponse.error);
        } else {
          likesCounts = countsResponse.data;
          console.log(`📊 Found ${likesCounts?.length || 0} total likes`);
        }
      } catch {
        console.log("⚠️ Likes counts not available, using zero counts");
        likesCounts = [];
      }

      // NEW: Get comments count for each post
      let commentsCounts = null;
      try {
        const commentsResponse = await supabase
          .from('comments')
          .select('post_id')
          .in('post_id', postsData.map(p => p.id));
        
        if (commentsResponse.error) {
          console.error("❌ Error fetching comments counts:", commentsResponse.error);
        } else {
          commentsCounts = commentsResponse.data;
          console.log(`💬 Found ${commentsCounts?.length || 0} total comments`);
        }
      } catch  {
        console.log("⚠️ Comments counts not available, using zero counts");
        commentsCounts = [];
      }

      // Process likes data
      const userLikedPostIds = new Set(
  (userLikes ?? []).map((like: { post_id: string }) => like.post_id)
);

const likesCountMap = new Map<string, number>();
const commentsCountMap = new Map<string, number>();


      likesCounts?.forEach((like: { post_id: string }) => {

        likesCountMap.set(like.post_id, (likesCountMap.get(like.post_id) || 0) + 1);
      });

      commentsCounts?.forEach((comment: { post_id: string }) => {

        commentsCountMap.set(comment.post_id, (commentsCountMap.get(comment.post_id) || 0) + 1);
      });

      // Combine posts with profile data
      const postsWithProfiles = postsData.map((post) => {
        const userProfile = profilesData?.find(
          (profile) => profile.id === post.user_id
        );

        console.log(`🔍 Post ${post.id}:`);
        console.log(`   - User ID: ${post.user_id}`);
        console.log(`   - Image URL from DB: ${post.image_url}`);
        console.log(`   - Found profile:`, userProfile);

        let displayName = "Unknown User";
        let displayAvatar = null;

        if (userProfile) {
          displayName =
            userProfile.name ||
            userProfile.full_name ||
            userProfile.username ||
            `user_${post.user_id?.slice(0, 8)}`;
          displayAvatar = userProfile.avatar_url;
        } else {
          if (post.user_id === user?.id && currentUserProfile) {
            displayName =
              currentUserProfile.name ||
              currentUserProfile.full_name ||
              currentUserProfile.username ||
              user?.email?.split("@")[0] ||
              "You";
            displayAvatar = currentUserProfile.avatar_url;
          } else {
            displayName = `user_${post.user_id?.slice(0, 8)}`;
          }
        }

        // Fix image URL
        const fixedImageUrl = post.image_url
          ? fixImageUrl(post.image_url)
          : null;

        console.log(`👤 Final for post ${post.id}:`);
        console.log(`   - Display name: ${displayName}`);
        console.log(`   - Final image URL: ${fixedImageUrl}`);
        console.log(`   - Likes count: ${likesCountMap.get(post.id) || 0}`);
        console.log(`   - Comments count: ${commentsCountMap.get(post.id) || 0}`);
        console.log(`   - User liked: ${userLikedPostIds.has(post.id)}`);

        return {
          ...post,
          username: displayName,
          avatar_url: displayAvatar,
          image_url: fixedImageUrl,
          likes_count: likesCountMap.get(post.id) || 0,
          comments_count: commentsCountMap.get(post.id) || 0,
          is_liked: userLikedPostIds.has(post.id),
        };
      });

      setPosts(postsWithProfiles);
      console.log("✅ Posts set successfully");
    } catch (error) {
      console.error("❌ Error in fetchPosts:", error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [user, currentUserProfile, fixImageUrl]);

  // Profile useEffect
  useEffect(() => {
    fetchCurrentUserProfile();
  }, [fetchCurrentUserProfile]);

  // ✅ Refresh profile when screen comes into focus
  useEffect(() => {
    if (isFocused && user) {
      fetchCurrentUserProfile();
    }
  }, [isFocused, user, fetchCurrentUserProfile]);

  // Real-time subscription for profile updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log("🔄 Profile updated in real-time:", payload.new);
          setCurrentUserProfile(payload.new as UserProfile);
        }
      )
      .subscribe();
      

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // UPDATED: Refresh posts when profile changes OR when profile is confirmed to be null
  useEffect(() => {
    console.log("🔄 Profile state changed, refreshing posts...");
    fetchPosts();
  }, [currentUserProfile, fetchPosts]);

  // UPDATED: Posts useEffect with real-time subscriptions for posts, likes, AND comments
  useEffect(() => {
    fetchPosts();

    // Posts subscription
    const postsChannel = supabase
      .channel("posts-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
        },
        (payload) => {
          console.log("🔄 New post detected, refreshing...");
          fetchPosts();
        }
      )
      .subscribe();

    // Likes subscription for real-time like updates
    const likesChannel = supabase
      .channel("likes-realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, DELETE)
          schema: "public",
          table: "likes",
        },
        (payload) => {
          console.log("🔄 Likes updated, refreshing posts...", payload);
          fetchPosts();
        }
      )
      .subscribe();

    // NEW: Comments subscription for real-time comment updates
    const commentsChannel = supabase
      .channel("comments-realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, DELETE)
          schema: "public",
          table: "comments",
        },
        (payload) => {
          console.log("🔄 Comments updated, refreshing posts...", payload);
          fetchPosts();
          
          // If comments modal is open for this post, refresh comments
          if (selectedPost && payload.new && (payload.new as Comment).post_id === selectedPost.id) {
            fetchComments(selectedPost.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [fetchPosts, selectedPost, fetchComments]);

  const renderItem = useCallback(
    ({ item }: { item: Post }) => {
      const isImageFailed = failedImages.has(item.image_url);
      const attempts = imageLoadAttempts[item.image_url] || 0;
      const isLoading = imageLoading[item.image_url];

      console.log(`🎬 Rendering post ${item.id}:`);
      console.log(`   - Image URL: ${item.image_url}`);
      console.log(`   - Failed: ${isImageFailed}`);
      console.log(`   - Attempts: ${attempts}`);
      console.log(`   - Loading: ${isLoading}`);
      console.log(`   - Likes: ${item.likes_count}, Liked: ${item.is_liked}`);
      console.log(`   - Comments: ${item.comments_count}`);

      // Handle avatar URL - FIXED: Always provide fallback URL
      const avatarUri = item.avatar_url
        ? fixImageUrl(item.avatar_url)
        : "https://cdn-icons-png.flaticon.com/512/149/149071.png";

      return (
        <View style={styles.postCard}>
          {/* User info with avatar - FIXED */}
          <View style={styles.postHeader}>
            <Image
              source={{
                uri:
                  avatarUri ||
                  "https://cdn-icons-png.flaticon.com/512/149/149071.png",
              }}
              style={styles.userAvatar}
              onError={() =>
                console.log("❌ Failed to load avatar:", avatarUri)
              }
              onLoad={() => console.log("✅ Avatar loaded:", avatarUri)}
            />
            <View style={styles.userInfo}>
              <Text style={styles.username}>
                {item.username}
                {item.user_id === user?.id && (
                  <Text style={styles.youBadge}> • You</Text>
                )}
              </Text>
              <Text style={styles.postTime}>
                {new Date(item.created_at).toLocaleDateString()} •
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>

          {/* Post content */}
          {item.text ? <Text style={styles.postText}>{item.text}</Text> : null}

          {/* Post image with enhanced loading */}
          {item.image_url && !isImageFailed ? (
            <View style={styles.imageContainer}>
              {isLoading && (
                <View style={styles.imageLoading}>
                  <ActivityIndicator size="large" color="#667eea" />
                  <Text style={styles.loadingText}>Loading image...</Text>
                </View>
              )}

              <Image
                source={{ uri: item.image_url }}
                style={styles.postImage}
                resizeMode="cover"
                onError={() => handleImageError(item.image_url, item.id)}
                onLoadStart={() => handleImageLoadStart(item.image_url)}
                onLoadEnd={() =>
                  setImageLoading((prev) => ({
                    ...prev,
                    [item.image_url]: false,
                  }))
                }
                onLoad={() => handleImageLoad(item.image_url)}
              />
            </View>
          ) : item.image_url && isImageFailed ? (
            <View style={styles.imageErrorContainer}>
              <Ionicons name="image-outline" size={48} color="#ccc" />
              <Text style={styles.imageErrorText}>Failed to load image</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  console.log(`🔄 Retrying image: ${item.image_url}`);
                  setImageLoadAttempts((prev) => ({
                    ...prev,
                    [item.image_url]: 0,
                  }));
                  setFailedImages((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(item.image_url);
                    return newSet;
                  });
                }}
              >
                <Text style={styles.retryText}>Retry Loading</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Engagement buttons */}
          <View style={styles.engagementBar}>
            <TouchableOpacity
              style={styles.engagementButton}
              onPress={() => handleLike(item.id, item.is_liked)}
            >
              <Ionicons
                name={item.is_liked ? "heart" : "heart-outline"}
                size={20}
                color={item.is_liked ? "#e74c3c" : "#666"}
              />
              <Text
                style={[
                  styles.engagementText,
                  item.is_liked && styles.likedText,
                ]}
              >
                {item.likes_count}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.engagementButton}
              onPress={() => openComments(item)}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#666" />
              <Text style={styles.engagementText}>{item.comments_count}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.engagementButton}>
              <Ionicons name="share-outline" size={18} color="#666" />
              <Text style={styles.engagementText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [
      failedImages,
      imageLoadAttempts,
      imageLoading,
      user,
      handleImageError,
      handleImageLoad,
      handleImageLoadStart,
      handleLike,
      openComments,
      fixImageUrl,
    ]
  );

  // Comments Modal Component
  const renderCommentsModal = () => (
    <Modal
      visible={commentsModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setCommentsModalVisible(false)}
    >
      <KeyboardAvoidingView 
        style={styles.modalContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setCommentsModalVisible(false)}
          >
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Comments</Text>
          <View style={styles.modalCloseButton} />
        </View>

        {/* Comments List */}
        {commentsLoading ? (
          <View style={styles.commentsLoading}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading comments...</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <Image
                  source={
                    item.avatar_url
                      ? { uri: fixImageUrl(item.avatar_url) }
                      : require("../assets/default-avatar.jpg")
                  }
                  style={styles.commentAvatar}
                />

                <View style={styles.commentContent}>
                  <Text style={styles.commentUsername}>
                    {item.username}
                    {item.user_id === user?.id && (
                      <Text style={styles.youBadge}> • You</Text>
                    )}
                  </Text>
                  <Text style={styles.commentText}>{item.text}</Text>
                  <Text style={styles.commentTime}>
                    {new Date(item.created_at).toLocaleDateString()} at{' '}
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
              </View>
            )}
            contentContainerStyle={styles.commentsList}
            ListEmptyComponent={
              <View style={styles.noComments}>
                <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
                <Text style={styles.noCommentsText}>No comments yet</Text>
                <Text style={styles.noCommentsSubtext}>
                  Be the first to comment on this post!
                </Text>
              </View>
            }
          />
        )}

        {/* Comment Input */}
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Write a comment..."
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.commentSendButton,
              (!newComment.trim() || postingComment) && styles.commentSendButtonDisabled
            ]}
            onPress={postComment}
            disabled={!newComment.trim() || postingComment}
          >
            {postingComment ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Handle header avatar - FIXED
  const headerAvatarUri =
    currentUserProfile?.avatar_url || user?.user_metadata?.avatar_url;
  const fixedHeaderAvatarUri = headerAvatarUri
    ? fixImageUrl(headerAvatarUri)
    : "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  return (
    <View style={styles.container}>
      {/* Beautiful Header - FIXED */}
      <View style={styles.header}>
        <View style={styles.headerBackground}>
          <View style={styles.gradientOverlay} />

          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate("Profile")}
            >
              <Image
                source={{
                  uri:
                    fixedHeaderAvatarUri ||
                    "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                }}
                style={styles.profileImage}
                onError={() =>
                  console.log("❌ Header avatar failed:", fixedHeaderAvatarUri)
                }
                onLoad={() =>
                  console.log("✅ Header avatar loaded:", fixedHeaderAvatarUri)
                }
              />
              <View style={styles.onlineIndicator} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <View style={styles.logoContainer}>
                <Ionicons name="camera" size={28} color="#fff" />
                <Text style={styles.headerTitle}>Framez</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Welcome,{" "}
                {currentUserProfile?.name ||
                 currentUserProfile?.full_name ||
                 currentUserProfile?.username ||
                 user?.email?.split("@")[0] ||
                 "User"}
                !
              </Text>
            </View>

            <TouchableOpacity style={styles.iconButton}>
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>3</Text>
              </View>
              <Ionicons name="notifications-outline" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Feed */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.feedContainer}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchPosts}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="camera-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySubtitle}>
                Be the first to share a moment!
              </Text>
            </View>
          }
        />
      )}

      {/* Comments Modal */}
      {renderCommentsModal()}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setActiveTab("home")}
        >
          <Ionicons
            name={activeTab === "home" ? "home" : "home-outline"}
            size={24}
            color={activeTab === "home" ? "#667eea" : "#666"}
          />
          <Text
            style={[
              styles.navText,
              activeTab === "home" && styles.activeNavText,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setActiveTab("search")}
        >
          <Ionicons
            name={activeTab === "search" ? "search" : "search-outline"}
            size={24}
            color={activeTab === "search" ? "#667eea" : "#666"}
          />
          <Text
            style={[
              styles.navText,
              activeTab === "search" && styles.activeNavText,
            ]}
          >
            Search
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate("Upload")}
        >
          <View style={styles.uploadButton}>
            <Ionicons name="add" size={28} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setActiveTab("messages")}
        >
          <Ionicons
            name={
              activeTab === "messages" ? "chatbubble" : "chatbubble-outline"
            }
            size={24}
            color={activeTab === "messages" ? "#667eea" : "#666"}
          />
          <Text
            style={[
              styles.navText,
              activeTab === "messages" && styles.activeNavText,
            ]}
          >
            Messages
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons
            name={activeTab === "profile" ? "person" : "person-outline"}
            size={24}
            color={activeTab === "profile" ? "#667eea" : "#666"}
          />
          <Text
            style={[
              styles.navText,
              activeTab === "profile" && styles.activeNavText,
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ... keep your existing styles the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  headerBackground: {
    backgroundColor: "#667eea",
    paddingTop: 50,
    paddingBottom: 20,
    position: "relative",
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#667eea",
    opacity: 0.9,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    zIndex: 1,
  },
  profileButton: {
    position: "relative",
    padding: 4,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4ade80",
    borderWidth: 2,
    borderColor: "#667eea",
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginLeft: 8,
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  iconButton: {
    padding: 8,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#ff4757",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    borderWidth: 1.5,
    borderColor: "#667eea",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  feedContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  postCard: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 16,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#000",
  },
  youBadge: {
    color: "#667eea",
    fontSize: 14,
    fontWeight: "600",
  },
  postTime: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  postText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#000",
    marginBottom: 12,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#f8f8f8",
    width: "100%",
    position: "relative",
  },
  postImage: {
    width: "100%",
    height: 300,
    backgroundColor: "#f8f8f8",
  },
  imageLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    zIndex: 1,
  },
  imageErrorContainer: {
    height: 200,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  imageErrorText: {
    marginTop: 8,
    fontSize: 16,
    color: "#666",
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#667eea",
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  engagementBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 8,
  },
  engagementButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  engagementText: {
    marginLeft: 6,
    fontSize: 13,
    color: "#666",
  },
  likedText: {
    color: "#e74c3c",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  uploadButton: {
    backgroundColor: "#667eea",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -20,
  },
  navText: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  activeNavText: {
    color: "#667eea",
    fontWeight: "600",
  },
  // Comments Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalCloseButton: {
    padding: 4,
    width: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  commentsLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#000',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
  },
  noComments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  noCommentsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    maxHeight: 100,
    marginRight: 12,
    fontSize: 15,
  },
  commentSendButton: {
    backgroundColor: '#667eea',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});