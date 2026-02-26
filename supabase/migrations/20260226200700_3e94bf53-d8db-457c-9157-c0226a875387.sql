
-- Allow users to delete their own notifications (for declining follow requests)
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);
