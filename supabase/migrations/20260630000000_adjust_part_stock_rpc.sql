-- Create an atomic function to safely adjust part stock and log the movement
CREATE OR REPLACE FUNCTION adjust_part_stock(
    p_id uuid,
    amount_delta int,
    p_user_id uuid,
    p_description text
) RETURNS void AS $$
BEGIN
    -- 1. Update the stock atomically
    UPDATE parts
    SET stock = stock + amount_delta
    WHERE id = p_id;

    -- 2. Log the movement
    INSERT INTO inventory_movements (
        type,
        item_type,
        item_id,
        quantity,
        description,
        user_id
    ) VALUES (
        CASE WHEN amount_delta < 0 THEN 'repair_usage' ELSE 'repair_return' END,
        'part',
        p_id,
        ABS(amount_delta),
        p_description,
        p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
