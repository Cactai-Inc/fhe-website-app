/*
  # profile-images goes public-READ (avatar upload wiring, owner 2026-07-02)

  Avatars render for OTHER members (directory, chat, messages), which a private
  owner-only-read bucket cannot serve without expiring signed URLs. Standard
  avatar posture: public read (unguessable object paths), while WRITES remain
  owner-scoped by the existing path-prefix policy (first folder = user_id).
*/
UPDATE storage.buckets SET public = true WHERE id = 'profile-images';
