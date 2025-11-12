import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  fetchUserProfile,
  uploadProfileImage,
  getUserPosts,
} from "../services/profileService";
import { useAuth } from "../context/AuthContext";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";

interface Post {
  id: string;
  text?: string;
  image_url?: string;
  user_id?: string;
  created_at?: string;
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const isFocused = useIsFocused();

  const [profile, setProfile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");

  
  const loadProfile = useCallback(async () => {
    if (!user) return;
    const data = await fetchUserProfile(user.id);
    setProfile(data);
  }, [user]); 

  
  const loadPosts = useCallback(async () => {
    if (!user) return;
    setLoadingPosts(true);
    try {
      const userPosts = await getUserPosts(user.id);
      setPosts(userPosts || []);
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      setLoadingPosts(false);
    }
  }, [user]); 

  
  useEffect(() => {
    if (!user) return;
    
    loadProfile();

    
    const profileSubscription = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Profile updated in real-time:', payload.new);
          setProfile(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileSubscription);
    };
  }, [user, loadProfile]); 

  
  useEffect(() => {
    if (isFocused && user) {
      loadProfile();
    }
  }, [isFocused, user, loadProfile]); 

  
  useEffect(() => {
    if (!user) return;
    
    
    loadPosts();

    
    const postsSubscription = supabase
      .channel('user-posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Posts updated, refreshing...', payload);
          loadPosts(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsSubscription);
    };
  }, [user, loadPosts]); 

  
  useEffect(() => {
    if (isFocused && user) {
      loadPosts();
    }
  }, [isFocused, user, loadPosts]); 

  
  const pickAndUploadImage = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert("Permission required", "Enable gallery access.");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled) return;

    setUploading(true);
    const imageUri = result.assets[0].uri;

    try {
      const imageUrl = await uploadProfileImage(user.id, imageUri);
      if (!imageUrl) {
        Alert.alert("Error", "Image upload failed.");
        return;
      }
      
      await loadProfile();
      Alert.alert("Success", "Profile picture updated!");
    } catch {
      Alert.alert("Error", "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  
  const handleDeletePost = async (postId: string) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("posts")
                .delete()
                .eq("id", postId)
                .eq("user_id", user?.id);

              if (error) throw error;

              
              setPosts((prev) => prev.filter((p) => p.id !== postId));
              Alert.alert("Deleted", "Post deleted successfully.");
            } catch (error) {
              console.error("Error deleting post:", error);
              Alert.alert("Error", "Failed to delete post.");
            }
          },
        },
      ]
    );
  };

  const renderPostItem = ({ item }: { item: Post }) => (
    <TouchableOpacity
      onLongPress={() => handleDeletePost(item.id)}
      delayLongPress={600}
      style={styles.postCard}
    >
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={styles.postImage}
          resizeMode="cover"
        />
      ) : null}
      {item.text ? <Text style={styles.postText}>{item.text}</Text> : null}
      <Text style={styles.postDate}>
        {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
      </Text>
    </TouchableOpacity>
  );

  
  const stats = [
    { label: "Posts", value: posts.length },
    { label: "Following", value: "0" },
    { label: "Followers", value: "0" },
  ];

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      
      <View style={styles.header}>
        <View style={styles.headerBackground} />
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={pickAndUploadImage}>
              <Image
                source={{
                  uri:
                    profile?.avatar_url ||
                    "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                }}
                style={styles.avatar}
              />
              <View style={styles.editAvatarButton}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            {uploading && (
              <ActivityIndicator
                size="small"
                color="#667eea"
                style={styles.uploadIndicator}
              />
            )}
          </View>

          <Text style={styles.name}>
            {profile?.full_name || profile?.username || profile?.name || "User"}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.bio}>
            {profile?.bio || "Welcome to my Framez profile! 📸"}
          </Text>

          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
              {index < stats.length - 1 && <View style={styles.statDivider} />}
            </View>
          ))}
        </View>

        
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "posts" && styles.activeTab]}
            onPress={() => setActiveTab("posts")}
          >
            <Ionicons
              name="grid"
              size={20}
              color={activeTab === "posts" ? "#667eea" : "#666"}
            />
            <Text
              style={[styles.tabText, activeTab === "posts" && styles.activeTabText]}
            >
              Posts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "photos" && styles.activeTab]}
            onPress={() => setActiveTab("photos")}
          >
            <Ionicons
              name="images"
              size={20}
              color={activeTab === "photos" ? "#667eea" : "#666"}
            />
            <Text
              style={[styles.tabText, activeTab === "photos" && styles.activeTabText]}
            >
              Photos
            </Text>
          </TouchableOpacity>
        </View>

        {loadingPosts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading posts...</Text>
          </View>
        ) : activeTab === "posts" ? (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPostItem}
            scrollEnabled={false}
            numColumns={2}
            columnWrapperStyle={styles.postsGrid}
            contentContainerStyle={styles.postsContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="camera-outline" size={64} color="#ccc" />
                <Text style={styles.emptyTitle}>No posts yet</Text>
                <Text style={styles.emptySubtitle}>Share your first moment!</Text>
                <TouchableOpacity
                  style={styles.createPostButton}
                  onPress={() => navigation.navigate("Upload")}
                >
                  <Text style={styles.createPostButtonText}>Create Post</Text>
                </TouchableOpacity>
              </View>
            }
          />
        ) : (
          <View style={styles.photosContainer}>
            <Text style={styles.comingSoonText}>Photos view coming soon!</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "transparent", overflow: "hidden" },
  headerBackground: {
    backgroundColor: "#667eea",
    height: 120,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  logoutButton: { padding: 8 },
  content: { flex: 1 },
  profileHeader: {
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: -40,
    marginBottom: 20,
  },
  avatarContainer: { position: "relative", marginBottom: 16 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: "#f8f8f8",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#667eea",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  uploadIndicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -10,
    marginTop: -10,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 4,
    textAlign: "center",
  },
  email: { fontSize: 16, color: "#666", marginBottom: 12, textAlign: "center" },
  bio: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  editProfileButton: {
    backgroundColor: "#667eea",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
    marginTop: 10,
  },
  editProfileButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
    marginHorizontal: 20,
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    position: "relative",
  },
  statValue: { fontSize: 18, fontWeight: "bold", color: "#000" },
  statLabel: { fontSize: 14, color: "#666", marginLeft: 4 },
  statDivider: {
    position: "absolute",
    right: 0,
    height: "60%",
    width: 1,
    backgroundColor: "#e0e0e0",
  },
  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  activeTab: { borderBottomWidth: 2, borderBottomColor: "#667eea" },
  tabText: { fontSize: 14, fontWeight: "600", color: "#666" },
  activeTabText: { color: "#667eea" },
  postsContainer: { paddingHorizontal: 10 },
  postsGrid: { justifyContent: "space-between", gap: 10, marginBottom: 10 },
  postCard: {
    flex: 1,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    overflow: "hidden",
    margin: 5,
    minHeight: 150,
  },
  postImage: { width: "100%", height: 120, backgroundColor: "#e0e0e0" },
  postText: { padding: 8, fontSize: 12, color: "#333", flex: 1 },
  postDate: { padding: 8, fontSize: 10, color: "#666" },
  loadingContainer: { padding: 40, alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#666" },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
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
    marginBottom: 20,
  },
  createPostButton: {
    backgroundColor: "#667eea",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createPostButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  photosContainer: { padding: 40, alignItems: "center" },
  comingSoonText: { fontSize: 16, color: "#666", textAlign: "center" },
});