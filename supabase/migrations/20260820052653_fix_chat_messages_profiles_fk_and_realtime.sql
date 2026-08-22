-- Add FK from chat_messages.user_id to profiles.id so PostgREST can resolve the join
DO $$ BEGIN
  ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add realtime publication for chat_messages and chat_groups
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_groups;
