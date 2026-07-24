import React, { useState, useEffect, useMemo } from 'react';
import { useGraph } from '../context/GraphContext';
import type { Assertion } from '../types/graph';
import { 
  X, 
  Beaker, 
  Play, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  PlusCircle, 
  Info
} from 'lucide-react';

interface TestSuiteLabProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestSuiteLab: React.FC<TestSuiteLabProps> = ({ isOpen, onClose }) => {
  const { 
    nodes, 
    testCases, 
    lastTestResults, 
    addTestCase, 
    deleteTestCase, 
    updateTestCase, 
    addAssertion, 
    deleteAssertion, 
    runTestSuite,
    clearTestResults
  } = useGraph();

  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [newCaseName, setNewCaseName] = useState('');
  const [isAddingCase, setIsAddingCase] = useState(false);

  // Assertion builder form state per testcase
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedPortId, setSelectedPortId] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<Assertion['operator']>('equals');
  const [expectedValue, setExpectedValue] = useState('');

  // Input injector builder state per testcase
  const [inputNodeId, setInputNodeId] = useState('');
  const [inputPortId, setInputPortId] = useState('');
  const [inputValue, setInputValue] = useState('');

  // Gather list of ports for input configuration
  const inputPortsList = useMemo(() => {
    const list: { key: string; nodeId: string; portId: string; label: string }[] = [];
    nodes.forEach(n => {
      // Input nodes and variables represent the starting logic vectors
      if (n.type === 'input' || n.type === 'variable') {
        n.outputs.forEach(p => {
          list.push({
            key: `${n.id}-${p.id}`,
            nodeId: n.id,
            portId: p.id,
            label: `${n.label} ➜ Out: ${p.name}`
          });
        });
      } else {
        // Operator / Condition inputs can also be overridden
        n.inputs.forEach(p => {
          list.push({
            key: `${n.id}-${p.id}`,
            nodeId: n.id,
            portId: p.id,
            label: `${n.label} ➜ In: ${p.name}`
          });
        });
      }
    });
    return list;
  }, [nodes]);

  // Gather list of ports for assertions
  const assertionPortsList = useMemo(() => {
    const list: { key: string; nodeId: string; portId: string; label: string }[] = [];
    nodes.forEach(n => {
      n.outputs.forEach(p => {
        list.push({
          key: `${n.id}-${p.id}`,
          nodeId: n.id,
          portId: p.id,
          label: `${n.label} ➜ Out: ${p.name}`
        });
      });
      // Loggers accept connection inputs
      n.inputs.forEach(p => {
        list.push({
          key: `${n.id}-${p.id}`,
          nodeId: n.id,
          portId: p.id,
          label: `${n.label} ➜ In: ${p.name}`
        });
      });
    });
    return list;
  }, [nodes]);

  // Initialize selected IDs on node list updates
  useEffect(() => {
    if (assertionPortsList.length > 0 && !selectedNodeId) {
      setSelectedNodeId(assertionPortsList[0].nodeId);
      setSelectedPortId(assertionPortsList[0].portId);
    }
    if (inputPortsList.length > 0 && !inputNodeId) {
      setInputNodeId(inputPortsList[0].nodeId);
      setInputPortId(inputPortsList[0].portId);
    }
  }, [assertionPortsList, inputPortsList, selectedNodeId, inputNodeId]);

  // Calculate overall test stats
  const stats = useMemo(() => {
    if (!lastTestResults || lastTestResults.length === 0) return null;
    const total = lastTestResults.length;
    const passed = lastTestResults.filter(r => r.passed).length;
    const passRate = Math.round((passed / total) * 100);

    // Calculate overall logic coverage
    // Coverage = total unique nodes executed in at least one test / total nodes in graph
    const allExecutedNodeIds = new Set<string>();
    lastTestResults.forEach(r => {
      r.executedNodeIds.forEach(id => allExecutedNodeIds.add(id));
    });
    const coverage = nodes.length > 0 ? Math.round((allExecutedNodeIds.size / nodes.length) * 100) : 0;

    return {
      total,
      passed,
      passRate,
      coverage,
      uniqueExecutedCount: allExecutedNodeIds.size
    };
  }, [lastTestResults, nodes]);

  // Expand testcase click helper
  const handleToggleExpand = (id: string) => {
    setExpandedCaseId(prev => (prev === id ? null : id));
    // Reset selections
    if (assertionPortsList.length > 0) {
      setSelectedNodeId(assertionPortsList[0].nodeId);
      setSelectedPortId(assertionPortsList[0].portId);
    }
    if (inputPortsList.length > 0) {
      setInputNodeId(inputPortsList[0].nodeId);
      setInputPortId(inputPortsList[0].portId);
    }
  };

  // Create new test case callback
  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseName.trim()) return;
    addTestCase(newCaseName.trim(), 'Verifies logic graph outputs.');
    setNewCaseName('');
    setIsAddingCase(false);
  };

  // Add mock input injector override callback
  const handleAddInputOverride = (caseId: string) => {
    if (!inputNodeId || !inputPortId || !inputValue.trim()) return;
    const tc = testCases.find(c => c.id === caseId);
    if (!tc) return;

    let parsedVal: any = inputValue;
    if (inputValue.toLowerCase() === 'true') parsedVal = true;
    else if (inputValue.toLowerCase() === 'false') parsedVal = false;
    else if (!isNaN(Number(inputValue)) && inputValue.trim() !== '') parsedVal = Number(inputValue);

    const key = `${inputNodeId}-${inputPortId}`;
    const nextInputs = { ...tc.inputs, [key]: parsedVal };
    updateTestCase(caseId, { inputs: nextInputs });
    setInputValue('');
  };

  // Delete mock input override callback
  const handleDeleteInputOverride = (caseId: string, portKey: string) => {
    const tc = testCases.find(c => c.id === caseId);
    if (!tc) return;
    const nextInputs = { ...tc.inputs };
    delete nextInputs[portKey];
    updateTestCase(caseId, { inputs: nextInputs });
  };

  // Add assertion callback
  const handleAddAssertion = (caseId: string) => {
    if (!selectedNodeId || !selectedPortId || !expectedValue.trim()) return;
    addAssertion(caseId, {
      nodeId: selectedNodeId,
      portId: selectedPortId,
      operator: selectedOperator,
      expectedValue: expectedValue.trim()
    });
    setExpectedValue('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-slate-950/95 border-l border-cyber-border/70 backdrop-blur-xl shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out font-sans select-none">
      
      {/* 1. Header Block */}
      <div className="p-5 border-b border-cyber-border/40 flex items-center justify-between bg-slate-900/30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-linear-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-orange-500/10 animate-pulse-glow">
            <Beaker className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wider text-white uppercase font-mono">Test Assertions Studio</h2>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">Logic suite test cases & coverage tracker</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2. Top Stats Dashboard Summary */}
      {stats && (
        <div className="p-4 border-b border-cyber-border/20 bg-slate-900/20 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 border border-cyber-border/10 bg-slate-950/40 rounded-xl space-y-1">
              <span className="text-[8px] font-mono font-bold text-slate-500 uppercase block leading-none">Pass Rate</span>
              <div className={`text-xl font-bold font-mono ${stats.passRate === 100 ? 'text-neon-green' : 'text-neon-yellow'}`}>
                {stats.passRate}%
              </div>
              <p className="text-[7.5px] text-slate-500 font-sans leading-none">{stats.passed} / {stats.total} Cases</p>
            </div>
            
            <div className="p-3 border border-cyber-border/10 bg-slate-950/40 rounded-xl space-y-1">
              <span className="text-[8px] font-mono font-bold text-slate-500 uppercase block leading-none">Node Coverage</span>
              <div className="text-xl font-bold font-mono text-neon-cyan">{stats.coverage}%</div>
              <p className="text-[7.5px] text-slate-500 font-sans leading-none">{stats.uniqueExecutedCount} / {nodes.length} Nodes</p>
            </div>

            <div className="p-3 border border-cyber-border/10 bg-slate-950/40 rounded-xl flex items-center justify-center">
              <button
                onClick={runTestSuite}
                className="w-full h-full bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-[10px] rounded-lg py-2 cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
              >
                <Play className="h-3 w-3 fill-white" /> RERUN ALL
              </button>
            </div>
          </div>

          {/* Coverage Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[8px] font-mono text-slate-500">
              <span>Logic Coverage progress meter</span>
              <span className="text-neon-cyan font-bold">{stats.coverage}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-900 border border-cyber-border/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-neon-cyan transition-all duration-500"
                style={{ width: `${stats.coverage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Workspace Action Buttons and Test Cases list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
        
        {/* Test suite empty state banner */}
        {!stats && (
          <div className="flex flex-col items-center justify-center text-center p-6 border border-cyber-border/20 bg-slate-900/10 rounded-xl space-y-2">
            <Beaker className="h-8 w-8 text-slate-600 animate-pulse" />
            <div className="text-xs font-mono font-bold text-slate-300">Test results are empty.</div>
            <p className="text-[10px] text-slate-500 leading-normal max-w-[280px]">
              Configure test input overrides and assertion constraints, then run tests.
            </p>
            <button
              onClick={runTestSuite}
              disabled={testCases.length === 0}
              className="px-4 py-1.5 text-[9.5px] font-mono font-bold bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg cursor-pointer transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              RUN TEST SUITE
            </button>
          </div>
        )}

        {/* Action Header controls */}
        <div className="flex justify-between items-center pb-2 border-b border-cyber-border/10">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Test Case Registry</span>
          <button
            onClick={() => setIsAddingCase(prev => !prev)}
            className="p-1 px-2.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-[10px] text-neon-purple font-mono font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> NEW CASE
          </button>
        </div>

        {/* Adding test case form */}
        {isAddingCase && (
          <form onSubmit={handleCreateCase} className="p-4 border border-cyber-border/40 bg-slate-900/30 rounded-xl space-y-3">
            <span className="text-[9px] font-mono font-bold text-slate-400 block uppercase">Create Test Case template</span>
            <div className="flex gap-2">
              <input 
                type="text"
                value={newCaseName}
                onChange={(e) => setNewCaseName(e.target.value)}
                placeholder="Case name (e.g. Fizzbuzz standard)"
                className="flex-1 text-xs font-mono bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 focus:outline-hidden"
              />
              <button 
                type="submit"
                disabled={!newCaseName.trim()}
                className="px-4 py-1.5 text-xs font-mono font-bold bg-neon-purple hover:bg-purple-500 text-white rounded cursor-pointer disabled:opacity-50"
              >
                CREATE
              </button>
            </div>
          </form>
        )}

        {/* Test cases list */}
        <div className="space-y-3">
          {testCases.length === 0 ? (
            <p className="text-[10px] text-slate-600 font-mono text-center py-6">No test cases found in register. Click NEW CASE to author.</p>
          ) : (
            testCases.map(tc => {
              const isExpanded = expandedCaseId === tc.id;
              const result = lastTestResults?.find(r => r.testCaseId === tc.id);
              
              let caseStatusColor = 'border-cyber-border/40';
              let caseStatusBadge = (
                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-slate-900 text-slate-500">
                  UNTESTED
                </span>
              );

              if (result) {
                if (result.passed) {
                  caseStatusColor = 'border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.05)]';
                  caseStatusBadge = (
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-neon-green border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> PASSED
                    </span>
                  );
                } else {
                  caseStatusColor = 'border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.05)]';
                  caseStatusBadge = (
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-neon-red border border-red-500/20 flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> FAILED
                    </span>
                  );
                }
              }

              return (
                <div 
                  key={tc.id}
                  className={`border rounded-xl bg-slate-950 transition-all duration-300 ${caseStatusColor}`}
                >
                  {/* Collapsed Header Bar */}
                  <div 
                    onClick={() => handleToggleExpand(tc.id)}
                    className="p-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-900/10"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />}
                      <div className="min-w-0">
                        <span className="text-xs font-bold font-mono text-slate-200 block truncate">{tc.name}</span>
                        {result && (
                          <span className="text-[8.5px] font-mono text-slate-500">
                            Executed in {result.durationMs}ms ➜ {result.assertionResults.length} checks
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      {caseStatusBadge}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTestCase(tc.id);
                        }}
                        className="p-1 hover:bg-slate-800 text-slate-600 hover:text-rose-400 rounded cursor-pointer"
                        title="Delete test case"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="border-t border-cyber-border/10 p-4 space-y-4 bg-slate-950/40">
                      
                      {/* Section 1: Mock input overrides list */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Input Overrides</span>
                        
                        {/* Current overrides list */}
                        {Object.keys(tc.inputs).length === 0 ? (
                          <p className="text-[8.5px] font-mono text-slate-600 pl-1">No input overrides set. Defaults will apply.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 pl-0.5">
                            {Object.entries(tc.inputs).map(([key, val]) => {
                              const matchPort = inputPortsList.find(p => p.key === key);
                              return (
                                <div key={key} className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/40 px-2 py-0.5 rounded-md text-[9px] font-mono text-slate-300">
                                  <span>{matchPort ? matchPort.label.split('➜')[0].trim() : key.split('-')[0]} ➜ <strong className="text-neon-cyan">{JSON.stringify(val)}</strong></span>
                                  <button 
                                    onClick={() => handleDeleteInputOverride(tc.id, key)}
                                    className="p-0.5 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded cursor-pointer"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Input overrides config form */}
                        <div className="flex gap-1.5 items-center bg-slate-900/20 p-2 rounded-lg border border-slate-800/40">
                          <select
                            value={`${inputNodeId}-${inputPortId}`}
                            onChange={(e) => {
                              const [nid, pid] = e.target.value.split('-');
                              setInputNodeId(nid || '');
                              setInputPortId(pid || '');
                            }}
                            className="flex-1 text-[9px] font-mono bg-slate-950 border border-slate-800 px-1 py-1 rounded text-slate-300 focus:outline-hidden"
                          >
                            {inputPortsList.map(item => (
                              <option key={item.key} value={item.key}>{item.label}</option>
                            ))}
                          </select>
                          <input 
                            type="text"
                            value={inputValue}
                            placeholder="Val"
                            onChange={(e) => setInputValue(e.target.value)}
                            className="w-20 text-[9px] font-mono bg-slate-950 border border-slate-800 px-2 py-1 rounded text-slate-300 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddInputOverride(tc.id)}
                            className="p-1 px-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-[9px] font-mono font-bold text-neon-cyan rounded flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <PlusCircle className="h-3 w-3" /> SET
                          </button>
                        </div>
                      </div>

                      {/* Section 2: Assertions configuration block */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider block font-bold">Assertion Checks</span>
                        
                        {/* Current assertions list */}
                        {tc.assertions.length === 0 ? (
                          <p className="text-[8.5px] font-mono text-slate-600 pl-1">No assertions defined. Add checks below.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {tc.assertions.map(assert => {
                              const matchPort = assertionPortsList.find(p => p.key === `${assert.nodeId}-${assert.portId}`);
                              const checkResult = result?.assertionResults.find(ar => ar.assertionId === assert.id);
                              
                              let statusIcon = <Info className="h-3 w-3 text-slate-500 shrink-0" />;
                              let statusColor = 'border-slate-800/40 text-slate-400 bg-slate-900/10';

                              if (checkResult) {
                                if (checkResult.passed) {
                                  statusIcon = <CheckCircle className="h-3 w-3 text-neon-green shrink-0 animate-pulse" />;
                                  statusColor = 'border-emerald-500/10 text-emerald-400 bg-emerald-500/5';
                                } else {
                                  statusIcon = <XCircle className="h-3 w-3 text-neon-red shrink-0" />;
                                  statusColor = 'border-red-500/10 text-rose-400 bg-red-500/5';
                                }
                              }

                              return (
                                <div 
                                  key={assert.id}
                                  className={`flex justify-between items-center border p-2 rounded-lg text-[9.5px] font-mono leading-tight ${statusColor}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {statusIcon}
                                    <div className="truncate">
                                      <span className="text-slate-300">
                                        {matchPort ? matchPort.label.split('➜')[0].trim() : assert.nodeId} 
                                        ({assert.portId})
                                      </span>
                                      <strong className="text-neon-purple mx-1.5">{assert.operator.toUpperCase()}</strong>
                                      <span className="text-slate-300 font-bold">&quot;{assert.expectedValue}&quot;</span>
                                      {checkResult && !checkResult.passed && (
                                        <div className="text-[8.5px] text-neon-red mt-0.5 leading-none">
                                          {checkResult.message}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => deleteAssertion(tc.id, assert.id)}
                                    className="p-1 hover:bg-slate-800/40 text-slate-500 hover:text-rose-400 rounded cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add assertion builder form */}
                        <div className="space-y-1.5 bg-slate-900/20 p-2.5 rounded-lg border border-slate-800/40">
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={`${selectedNodeId}-${selectedPortId}`}
                              onChange={(e) => {
                                const [nid, pid] = e.target.value.split('-');
                                setSelectedNodeId(nid || '');
                                setSelectedPortId(pid || '');
                              }}
                              className="text-[9px] font-mono bg-slate-950 border border-slate-800 px-1 py-1 rounded text-slate-300 focus:outline-hidden"
                            >
                              {assertionPortsList.map(item => (
                                <option key={item.key} value={item.key}>{item.label}</option>
                              ))}
                            </select>

                            <select
                              value={selectedOperator}
                              onChange={(e) => setSelectedOperator(e.target.value as any)}
                              className="text-[9px] font-mono bg-slate-950 border border-slate-800 px-1 py-1 rounded text-slate-300 focus:outline-hidden"
                            >
                              <option value="equals">equals (==)</option>
                              <option value="not_equals">not equals (!=)</option>
                              <option value="greater_than">greater than (&gt;)</option>
                              <option value="less_than">less than (&lt;)</option>
                              <option value="contains">contains</option>
                              <option value="is_type">has type</option>
                            </select>
                          </div>

                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={expectedValue}
                              placeholder="Expected outcome value (e.g. 15, true)"
                              onChange={(e) => setExpectedValue(e.target.value)}
                              className="flex-1 text-[9px] font-mono bg-slate-950 border border-slate-800 px-2 py-1 rounded text-slate-300 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddAssertion(tc.id)}
                              className="px-3 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-[9px] font-mono font-bold text-neon-purple rounded flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Plus className="h-3 w-3" /> ADD CHECK
                            </button>
                          </div>
                        </div>

                      </div>

                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* 4. Footer Console Controls */}
      <div className="px-5 py-4 border-t border-cyber-border/40 bg-slate-900/40 flex items-center justify-between shrink-0">
        <p className="text-[9px] font-mono text-slate-500 leading-normal max-w-[280px]">
          Assertion checks automatically visual evaluate topological results and color-code graph canvas.
        </p>
        <div className="flex items-center gap-2">
          {lastTestResults && (
            <button
              onClick={clearTestResults}
              className="px-3.5 py-1.5 text-[10px] font-mono border border-slate-800 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
            >
              CLEAR RESULTS
            </button>
          )}
          <button 
            onClick={runTestSuite}
            disabled={testCases.length === 0}
            className="px-4 py-1.5 text-[10px] font-mono font-bold bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg cursor-pointer transition-all disabled:opacity-50"
          >
            RUN TEST SUITE
          </button>
        </div>
      </div>

    </div>
  );
};
