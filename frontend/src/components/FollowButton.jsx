import { useEffect, useState } from "react";
import { apiFollow, apiUnfollow, apiIsFollowing } from "../lib/api";
import { useAuth } from "../store/auth";

export default function FollowButton({ userId, onChange }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user?._id || !userId || user._id === userId) return;
        const { following } = await apiIsFollowing(userId);
        if (mounted) setFollowing(!!following);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [user?._id, userId]);

  if (!user || !userId || user._id === userId) return null;

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (following) await apiUnfollow(userId);
      else await apiFollow(userId);
      setFollowing(!following);
      onChange && onChange(!following);
    } catch (e) {
      alert(e?.response?.data?.error || "Failed");
    } finally { setLoading(false); }
  };

  return (
    <button className={`btn ${following ? "btn-outline" : "btn-primary"}`} onClick={toggle} disabled={loading}>
      {following ? "Unfollow" : "Follow"}
    </button>
  );
}
