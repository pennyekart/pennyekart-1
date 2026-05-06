INSERT INTO public.app_settings (key, value) VALUES
  ('pennycarbs_table','food_items'),
  ('pennycarbs_images_table','food_item_images'),
  ('pennycarbs_images_fk','food_item_id'),
  ('pennycarbs_image_col','image_url'),
  ('pennycarbs_available_col','is_available'),
  ('pennycarbs_items_api_url','')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();