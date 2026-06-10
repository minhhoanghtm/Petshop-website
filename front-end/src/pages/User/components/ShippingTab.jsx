import { useOutletContext } from "react-router-dom";
import ShippingInfo from "./ShippingInfo";

const ShippingTab = () => {
    const { handleShippingUpdated } = useOutletContext();
    return <ShippingInfo onAddressUpdated={handleShippingUpdated} />;
};

export default ShippingTab;
