import { useParams } from 'react-router-dom';
import { LeadJourneyMap } from '@/components/journey-map';

const JourneyMapPage = () => {
    const { leadId } = useParams<{ leadId: string }>();

    if (!leadId) {
        return <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-500">ID do lead não fornecido.</div>;
    }

    return (
        <LeadJourneyMap
            leadId={leadId}
            mode="page"
            isOpen={true} // Passed just in case, though ignored in page mode logic
            onClose={() => { }} // No-op
        />
    );
};

export default JourneyMapPage;
