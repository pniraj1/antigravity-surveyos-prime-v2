'use client';

import React, { useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BrainCircuit } from 'lucide-react';

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getGeminiKey(): Promise<string> {
  const configDoc = await getDoc(doc(db, 'ai_config', 'routing'));
  if (configDoc.exists()) {
    const data = configDoc.data();
    const geminiProvider = (data.providers || []).find(
      (p: { name?: string; type?: string; enabled?: boolean; keys?: string[]; key?: string }) =>
        p.enabled && (p.name === 'gemini' || p.type === 'gemini')
    );
    if (geminiProvider) {
      const keys: string[] = geminiProvider.keys ?? (geminiProvider.key ? [geminiProvider.key] : []);
      if (keys[0]) return keys[0];
    }
    // Fallback: first enabled provider's first key (may be Groq etc.)
    const anyProvider = (data.providers || []).find(
      (p: { enabled?: boolean; keys?: string[]; key?: string }) => p.enabled
    );
    if (anyProvider) {
      const keys: string[] = anyProvider.keys ?? (anyProvider.key ? [anyProvider.key] : []);
      if (keys[0]) return keys[0];
    }
  }
  throw new Error('No Gemini API key found in ai_config/routing. Add one in Profile → AI & Documents Intelligence.');
}

async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = await getGeminiKey();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini embedding API error ${res.status}: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`);
  }
  const json = await res.json() as { embedding?: { values?: number[] } };
  const values = json.embedding?.values;
  if (!values || values.length === 0) throw new Error('Empty embedding returned from Gemini.');
  return values;
}

export default function BramhaAdminDashboard() {
  const [simulationQuery, setSimulationQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  const runSimulation = async () => {
    if (!simulationQuery.trim()) return;

    setIsSearching(true);
    setError('');
    setResults([]);

    try {
      // 1. Embed the query via Gemini REST API (client-side, static-export compatible)
      const queryVector = await generateEmbedding(simulationQuery);

      // 2. Fetch memories and calculate cosine similarity locally
      const memoriesRef = collection(db, 'bramha_memories');
      const snapshot = await getDocs(memoriesRef);

      const scoredMemories: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Firestore Vector fields expose .toArray() or are plain arrays depending on SDK version
        const embedding: number[] = Array.isArray(data.embedding)
          ? data.embedding
          : typeof data.embedding?.toArray === 'function'
          ? data.embedding.toArray()
          : [];
        if (embedding.length > 0) {
          scoredMemories.push({ id: docSnap.id, score: cosineSimilarity(queryVector, embedding), ...data });
        }
      });

      // 3. Sort by score, take top 3
      scoredMemories.sort((a, b) => b.score - a.score);
      setResults(scoredMemories.slice(0, 3));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to run Bramha simulation.';
      setError(msg);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="flex items-center space-x-4">
        <BrainCircuit className="w-10 h-10 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Bramha</h1>
          <p className="text-muted-foreground">Universal Intelligence Control Center (Shadow Mode)</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Simulator Column */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bramha Simulator</CardTitle>
              <CardDescription>
                Test Bramha&apos;s memory by describing a damage scenario. It will retrieve the most similar past claims.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="e.g. Honda City 2023 at Elite Motors, replacing a front bumper and repairing the right fender..."
                className="min-h-[150px]"
                value={simulationQuery}
                onChange={(e) => setSimulationQuery(e.target.value)}
              />
              <Button
                onClick={runSimulation}
                disabled={isSearching || !simulationQuery.trim()}
                className="w-full"
              >
                {isSearching
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <BrainCircuit className="mr-2 h-4 w-4" />}
                {isSearching ? 'Embedding & Searching...' : 'Simulate Intelligence'}
              </Button>

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-md text-sm border border-red-200">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results Column */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Retrieved Memories</h3>
          {results.length === 0 && !isSearching && (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg text-muted-foreground text-center">
              <BrainCircuit className="w-12 h-12 mb-4 opacity-20" />
              <p>Run a simulation to see what Bramha remembers.</p>
            </div>
          )}

          <div className="space-y-4">
            {results.map((memory, index) => (
              <Card key={memory.id} className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="py-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{memory.vehicleMake} {memory.vehicleModel}</CardTitle>
                      <CardDescription>
                        Claim ID: {memory.claimId}
                        {typeof memory.score === 'number' && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({(memory.score * 100).toFixed(1)}% match)
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">Match #{index + 1}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-3 bg-muted/30">
                  <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                    {memory.memoryChunk}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
