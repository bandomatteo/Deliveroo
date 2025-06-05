(define (domain deliveroo)
  (:requirements :strips :typing)
  (:types 
    agent
    parcel
    tile
    base
  )

  (:predicates 
    ;; agent ?a is on tile ?t
    (at ?a - agent ?t - tile)

    ;; parcel ?p is on tile ?t (not yet picked up)
    (parcel-at ?p - parcel ?t - tile)

    ;; agent ?a is carrying parcel ?p
    (carrying ?a - agent ?p - parcel)

    ;; base ?b is located on tile ?t
    (base-at ?b - base ?t - tile)

    ;; parcel ?p has been delivered (i.e. deposited)
    (delivered ?p - parcel)

    ;; adjacency relation between tiles
    (adjacent ?t1 - tile ?t2 - tile)
  )

  ;; ACTION MOVE 
  ;; move: move an agent from one tile to an adjacent tile
  (:action move
    :parameters (?a - agent ?from - tile ?to - tile)
    :precondition (and 
      (at ?a ?from)
      (adjacent ?from ?to)
    )
    :effect (and
      (not (at ?a ?from))
      (at ?a ?to)
    )
  )

 ;; PICKUP MOVE 
  ;; pickup: agent picks up a parcel on its tile
  (:action pickup
    :parameters (?a - agent ?p - parcel ?t - tile)
    :precondition (and
      (at ?a ?t)
      (parcel-at ?p ?t)
    )
    :effect (and
      (not (parcel-at ?p ?t))
      (carrying ?a ?p)
    )
  )

   ;; DEPOSIT MOVE 
  ;; deposit: agent deposits a carried parcel at a base tile
  (:action deposit
    :parameters (?a - agent ?p - parcel ?b - base ?t - tile)
    :precondition (and
      (at ?a ?t)
      (base-at ?b ?t)
      (carrying ?a ?p)
    )
    :effect (and
      (not (carrying ?a ?p))
      (delivered ?p)
    )
  )
)