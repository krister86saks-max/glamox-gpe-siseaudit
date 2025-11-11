// client/src/pages/SupplierAuditPage.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { SupplierAudit, SupplierAuditTemplate, SupplierAuditPoint, SubQuestion, SubOption } from '../types/audit';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

const SupplierAuditPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [audit, setAudit] = useState<SupplierAudit | null>(null);
  const [templates, setTemplates] = useState<SupplierAuditTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get('/api/templates');
      setTemplates(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      const res = await axios.get(`/api/templates/${selectedTemplateId}`);
      const template: SupplierAuditTemplate = res.data;

      setAudit({
        id: uuidv4(),
        supplierName: '',
        auditor: '',
        auditee: '',
        date: new Date().toISOString().substring(0, 10),
        points: template.points.map((p: SupplierAuditPoint) => ({
          ...p,
          subQuestions: p.subQuestions.map((sq) => ({
            ...sq,
            answerText: '',
            answerOptions: []
          }))
        }))
      });

      toast.success('Küsimustik avatud!');
    } catch (error) {
      console.error(error);
      toast.error('Viga küsimustiku avamisel');
    }
  };

  const addPoint = () => {
    if (!isAdmin) return toast.error("Punkte saab lisada ainult admin!");
    if (!audit) return;

    const newPoint: SupplierAuditPoint = {
      id: uuidv4(),
      title: 'Uus punkt',
      subQuestions: []
    };

    setAudit({ ...audit, points: [...audit.points, newPoint] });
  };

  const deletePoint = (pointId: string) => {
    if (!isAdmin) return toast.error("Kustutada saab ainult admin!");
    if (!audit) return;

    setAudit({ ...audit, points: audit.points.filter((p) => p.id !== pointId) });
  };

  const addOpenQuestion = (pointId: string) => {
    if (!isAdmin) return toast.error("Küsimusi saab lisada ainult admin!");

    if (!audit) return;
    const updated = audit.points.map((p) =>
      p.id === pointId
        ? {
            ...p,
            subQuestions: [
              ...p.subQuestions,
              {
                id: uuidv4(),
                text: 'Uus küsimus',
                type: 'open',
                answerText: ''
              }
            ]
          }
        : p
    );
    setAudit({ ...audit, points: updated });
  };

  const addMultiQuestion = (pointId: string) => {
    if (!isAdmin) return toast.error("Küsimusi saab lisada ainult admin!");

    if (!audit) return;
    const updated = audit.points.map((p) =>
      p.id === pointId
        ? {
            ...p,
            subQuestions: [
              ...p.subQuestions,
              {
                id: uuidv4(),
                text: 'Valikvastustega küsimus',
                type: 'multi',
                options: [
                  { id: uuidv4(), label: 'Vastus 1' },
                  { id: uuidv4(), label: 'Vastus 2' }
                ],
                answerOptions: []
              }
            ]
          }
        : p
    );
    setAudit({ ...audit, points: updated });
  };

  const deleteQuestion = (pointId: string, sqId: string) => {
    if (!isAdmin) return toast.error("Küsimusi saab kustutada ainult admin!");
    if (!audit) return;

    const updated = audit.points.map((p) =>
      p.id === pointId
        ? { ...p, subQuestions: p.subQuestions.filter((sq) => sq.id !== sqId) }
        : p
    );
    setAudit({ ...audit, points: updated });
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">GPE Auditor 2.0</h1>

      {/* Template selection */}
      <div className="flex gap-2 mb-4">
        <select
          className="border p-2 rounded bg-white"
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
        >
          <option value="">— Vali auditi liik —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <button className="bg-green-200 px-4 py-2 rounded font-semibold" onClick={loadTemplate}>
          Ava küsimustik
        </button>
      </div>

      {/* Audit questions */}
      {audit && (
        <>
          <h2 className="text-xl font-bold mb-3">Auditipunktid</h2>

          {isAdmin && (
            <button
              onClick={addPoint}
              className="bg-black text-white px-4 py-2 rounded mb-3"
            >
              + Lisa punkt
            </button>
          )}

          {audit.points.map((p, i) => (
            <div key={p.id} className="border rounded p-3 mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-lg">{i + 1}. {p.title}</span>

                {isAdmin && (
                  <button className="text-red-500" onClick={() => deletePoint(p.id)}>
                    Kustuta punkt
                  </button>
                )}
              </div>

              {p.subQuestions.map((sq) => (
                <div key={sq.id} className="pl-4 pb-2 border-b">
                  <b>{sq.text}</b>
                  {isAdmin && (
                    <button
                      className="text-red-500 ml-2"
                      onClick={() => deleteQuestion(p.id, sq.id)}
                    >
                      x
                    </button>
                  )}
                </div>
              ))}

              {isAdmin && (
                <div className="flex gap-2 mt-2">
                  <button className="bg-gray-200 px-3 py-1 rounded" onClick={() => addOpenQuestion(p.id)}>
                    + Küsimus
                  </button>

                  <button className="bg-gray-200 px-3 py-1 rounded" onClick={() => addMultiQuestion(p.id)}>
                    + Valikvastustega
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default SupplierAuditPage;
