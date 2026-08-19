import { useState } from 'react';
import { Database, Zap, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

export default function DataGeneration() {
  const [count, setCount] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await api.generateData(count);
      setResult(res);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-6">Data Generation</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Database size={20} className="text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Generate Test Data</h2>
            <p className="text-sm text-gray-500">Create realistic malaria case records for testing</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Number of Cases to Generate</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="200"
                step="5"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="w-20 text-center">
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={count}
                  onChange={(e) => setCount(Math.min(200, Math.max(5, parseInt(e.target.value) || 5)))}
                  className="w-16 text-center h-9 rounded-md border border-gray-300 text-sm font-medium"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">Min: 5, Max: 200 cases per generation</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-700">
              <strong>Note:</strong> Generated cases will use existing facilities and users in the database. Each batch creates realistic data with random names, ages, symptoms, and outcomes.
            </p>
          </div>

          {result && (
            <div className={`p-3 rounded-lg text-sm ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {result.error || `Successfully generated ${result.count} test cases`}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap size={16} />
                Generate {count} Cases
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
