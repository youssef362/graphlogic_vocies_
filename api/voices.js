export default async function handler(request, response) {
  const { urlString } = request.query;

  // Security check: Only allow calls to ElevenLabs
  if (!urlString || !urlString.includes('api.elevenlabs.io')) {
    return response.status(400).json({ error: 'Invalid API call' });
  }

  try {
    const result = await fetch(urlString, {
      method: 'GET',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY, // This uses the key from Vercel settings
        'Content-Type': 'application/json',
      },
    });

    const data = await result.json();
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
