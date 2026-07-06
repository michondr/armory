import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// Capture a target photo (camera or gallery) and downscale it client-side before
// it enters the upload queue — same as the web app crops/downscales before upload,
// to keep range uploads small over a phone connection.

const MAX_DIM = 1600;

async function downscale(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIM } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

/** Take a photo with the camera. Returns a downscaled local URI, or null if cancelled. */
export async function capturePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: true });
  if (res.canceled || !res.assets[0]) return null;
  return downscale(res.assets[0].uri);
}

/** Pick a photo from the gallery. Returns a downscaled local URI, or null if cancelled. */
export async function pickPhoto(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
  if (res.canceled || !res.assets[0]) return null;
  return downscale(res.assets[0].uri);
}
